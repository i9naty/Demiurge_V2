import Peer, { MediaConnection } from 'peerjs';

interface VoicePeer {
  userId: string;
  username: string;
  peerId: string;
}

interface VoiceState {
  isMuted: boolean;
  isDeafened: boolean;
  volume: number;
  isSpeaking: boolean;
}

export class VoiceService {
  private peer: Peer | null = null;
  private localStream: MediaStream | null = null;
  private connections = new Map<string, MediaConnection>();
  private analysers = new Map<string, { analyser: AnalyserNode; interval: ReturnType<typeof setInterval> }>();
  private onPeerJoined?: (peer: VoicePeer) => void;
  private onPeerLeft?: (userId: string) => void;
  private onSpeakingChange?: (userId: string, speaking: boolean) => void;
  private socket: any;
  private userId: string;
  private voiceState: VoiceState = { isMuted: true, isDeafened: false, volume: 0.75, isSpeaking: false };
  private audioContext: AudioContext | null = null;
  private channelId: string | null = null;

  constructor(socket: any, userId: string) {
    this.socket = socket;
    this.userId = userId;
  }

  setCallbacks(callbacks: {
    onPeerJoined?: (peer: VoicePeer) => void;
    onPeerLeft?: (userId: string) => void;
    onSpeakingChange?: (userId: string, speaking: boolean) => void;
  }) {
    this.onPeerJoined = callbacks.onPeerJoined;
    this.onPeerLeft = callbacks.onPeerLeft;
    this.onSpeakingChange = callbacks.onSpeakingChange;
  }

  async joinChannel(channelId: string) {
    await this.leaveChannel();
    this.channelId = channelId;

    this.peer = new Peer(this.socket.id, { debug: 0 });

    this.peer.on('call', async (call) => {
      await this.startLocalStream();
      if (!this.localStream) return;
      const remoteUserId = String(call.metadata?.userId || '');
      try {
        call.answer(this.localStream);
        this.setupCallHandlers(call, remoteUserId);
      } catch (e) { console.warn('Answer error:', e); }
    });

    await new Promise<void>((resolve) => {
      this.peer!.on('open', () => resolve());
      this.peer!.on('error', () => resolve());
      setTimeout(() => resolve(), 4000);
    });
  }

  async leaveChannel() {
    this.closeAllConnections();
    this.stopLocalStream();
    if (this.peer) { this.peer.destroy(); this.peer = null; }
    if (this.audioContext) { this.audioContext.close(); this.audioContext = null; }
    this.channelId = null;
  }

  connectToPeers(participants: VoicePeer[]) {
    if (!this.peer) return;
    this.startLocalStream();

    for (const p of participants) {
      if (p.userId === this.userId) continue;
      if (this.connections.has(p.userId)) continue;

      // Only initiate call if we have the "lower" socket ID (prevents duplicate connections)
      if (this.socket.id < p.peerId) {
        this.callPeer(p);
      }
      // Otherwise, wait for the other peer to call us via peer.on('call')
    }
  }

  private async callPeer(peer: VoicePeer) {
    if (!this.peer) return;
    await this.startLocalStream();
    if (!this.localStream) return;

    try {
      const call = this.peer.call(peer.peerId, this.localStream, {
        metadata: { userId: this.userId },
      });
      this.setupCallHandlers(call, peer.userId);
      this.connections.set(peer.userId, call);
      this.onPeerJoined?.(peer);
    } catch (e) { console.warn('Call error:', e); }
  }

  private setupCallHandlers(call: MediaConnection, remoteUserId: string) {
    call.on('stream', (remoteStream) => {
      this.playRemoteStream(remoteUserId, remoteStream);
    });
    call.on('close', () => {
      this.closePeerConnection(remoteUserId);
    });
    call.on('error', () => {
      this.closePeerConnection(remoteUserId);
    });

    if (this.voiceState.isDeafened && call.peerConnection) {
      call.peerConnection.getReceivers().forEach(r => {
        if (r.track) r.track.enabled = false;
      });
    }
  }

  private async startLocalStream(): Promise<void> {
    if (this.localStream) return;
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !this.voiceState.isMuted;
      });
      this.startSpeakingDetection(this.userId, this.localStream);
    } catch (e) {
      console.warn('Microphone unavailable:', e);
      this.localStream = null;
    }
  }

  private stopLocalStream() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
    this.stopSpeakingDetection(this.userId);
  }

  private playRemoteStream(userId: string, stream: MediaStream) {
    if (!this.audioContext) this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(stream);
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = this.voiceState.volume;
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    this.startSpeakingDetection(userId, stream);
  }

  private startSpeakingDetection(userId: string, stream: MediaStream) {
    if (!this.audioContext) this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(stream);
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const interval = setInterval(() => {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      const speaking = avg > 10;
      if (userId === this.userId) {
        this.voiceState.isSpeaking = speaking;
        this.socket.emit('voice:speaking', { userId: this.userId, speaking });
      }
      this.onSpeakingChange?.(userId, speaking);
    }, 150);
    this.analysers.set(userId, { analyser, interval });
  }

  private stopSpeakingDetection(userId: string) {
    const entry = this.analysers.get(userId);
    if (entry) { clearInterval(entry.interval); this.analysers.delete(userId); }
  }

  private closePeerConnection(userId: string) {
    const call = this.connections.get(userId);
    if (call) { try { call.close(); } catch {} this.connections.delete(userId); }
    this.stopSpeakingDetection(userId);
    this.onPeerLeft?.(userId);
  }

  private closeAllConnections() {
    this.connections.forEach((call, userId) => {
      try { call.close(); } catch {}
      this.stopSpeakingDetection(userId);
    });
    this.connections.clear();
  }

  setMuted(muted: boolean) {
    this.voiceState.isMuted = muted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(t => { t.enabled = !muted; });
    }
  }

  setDeafened(deafened: boolean) {
    this.voiceState.isDeafened = deafened;
    this.connections.forEach((call) => {
      call.peerConnection?.getReceivers().forEach(r => {
        if (r.track) r.track.enabled = !deafened;
      });
    });
  }

  setVolume(vol: number) {
    this.voiceState.volume = Math.max(0, Math.min(1, vol));
    localStorage.setItem('demiurge_voice_volume', String(this.voiceState.volume));
  }

  getState(): VoiceState {
    return { ...this.voiceState };
  }
}
