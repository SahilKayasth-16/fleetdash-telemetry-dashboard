import { z } from 'zod';

// Zod schema for validating the raw telemetry payload
export const rawTelemetrySchema = z.object({
  vehicleId: z
    .string({
      required_error: 'vehicleId is required',
      invalid_type_error: 'vehicleId must be a string',
    })
    .min(3, { message: 'vehicleId must be at least 3 characters' })
    .max(30, { message: 'vehicleId cannot exceed 30 characters' })
    .regex(/^[a-zA-Z0-9_-]+$/, {
      message: 'vehicleId must contain only alphanumeric characters, dashes, or underscores',
    }),
  latitude: z
    .number({
      required_error: 'latitude is required',
      invalid_type_error: 'latitude must be a number',
    })
    .min(-90, { message: 'latitude must be between -90 and 90' })
    .max(90, { message: 'latitude must be between -90 and 90' }),
  longitude: z
    .number({
      required_error: 'longitude is required',
      invalid_type_error: 'longitude must be a number',
    })
    .min(-180, { message: 'longitude must be between -180 and 180' })
    .max(180, { message: 'longitude must be between -180 and 180' }),
  speed: z
    .number({
      required_error: 'speed is required',
      invalid_type_error: 'speed must be a number',
    })
    .min(0, { message: 'speed cannot be negative' })
    .max(250, { message: 'speed cannot exceed 250 mph' }),
  heading: z
    .number({
      required_error: 'heading is required',
      invalid_type_error: 'heading must be a number',
    })
    .min(0, { message: 'heading must be between 0 and 360' })
    .max(360, { message: 'heading must be between 0 and 360' }),
  timestamp: z
    .string({
      required_error: 'timestamp is required',
      invalid_type_error: 'timestamp must be an ISO string',
    })
    .datetime({
      message: 'timestamp must be a valid ISO 8601 UTC date string (e.g. YYYY-MM-DDTHH:mm:ssZ)',
    })
    .refine(
      (val) => {
        const date = new Date(val);
        const now = new Date();
        const timeDiff = date.getTime() - now.getTime();
        const ageDiff = now.getTime() - date.getTime();
        return timeDiff < 5 * 60 * 1000 && ageDiff < 30 * 24 * 60 * 60 * 1000;
      },
      { message: 'timestamp cannot be in the future or older than 30 days' },
    ),
});
