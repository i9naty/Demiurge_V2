import { z } from 'zod';

export const emailSchema = z
  .string()
  .email('Некорректный email')
  .max(255, 'Email слишком длинный');

export const usernameSchema = z
  .string()
  .min(3, 'Никнейм должен быть не менее 3 символов')
  .max(32, 'Никнейм должен быть не более 32 символов')
  .regex(/^[a-zA-Z0-9а-яА-ЯёЁ_\-\s]+$/, 'Никнейм содержит недопустимые символы');

export const passwordSchema = z
  .string()
  .min(8, 'Пароль должен быть не менее 8 символов')
  .max(128, 'Пароль слишком длинный');

export const codeSchema = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Код содержит недопустимые символы');

export const contentSchema = z
  .string()
  .min(1, 'Сообщение не может быть пустым')
  .max(10_000, 'Сообщение слишком длинное');

export const imageUrlSchema = z
  .string()
  .url('Некорректный URL')
  .max(2048)
  .refine(
    (url) => !url.startsWith('javascript:') && !url.startsWith('data:'),
    'Недопустимый протокол URL',
  );

export const optionalImageUrlSchema = z
  .string()
  .url('Некорректный URL')
  .max(2048)
  .refine(
    (url) => !url.startsWith('javascript:') && !url.startsWith('data:'),
    'Недопустимый протокол URL',
  )
  .optional()
  .nullable();

export const positiveIntSchema = z.number().int().positive().finite();

export const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Пароль обязателен'),
});

export const guestSchema = z.object({
  displayName: usernameSchema.optional(),
});

export const createRoomSchema = z.object({
  name: z.string().min(1, 'Название обязательно').max(128),
  mode: z.enum(['vtt', 'story', 'world']),
  gridType: z.enum(['square', 'hex', 'isometric', 'none']).optional(),
  password: z.string().max(128).optional(),
  gameType: z.string().max(64).default('D&D 5e'),
  worldConfig: z
    .object({
      biome: z.string().max(32).optional(),
      density: z.enum(['sparse', 'normal', 'dense']).optional(),
      difficulty: z.enum(['easy', 'normal', 'hard']).optional(),
      seed: z.number().optional(),
    })
    .optional(),
});

export const authPayloadSchema = z.object({
  userId: z.string().uuid(),
  username: z.string(),
  role: z.string().default('player'),
  isGuest: z.boolean().optional(),
});
