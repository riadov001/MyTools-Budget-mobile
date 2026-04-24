import { z } from 'zod';
import { 
  insertUserSchema, 
  insertApplicationSchema, 
  insertServiceSchema, 
  insertReminderSettingsSchema,
  loginSchema,
  registerSchema,
  users, 
  applications, 
  services, 
  reminderSettings 
} from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  unauthorized: z.object({ message: z.string() }),
  forbidden: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

export const api = {
  auth: {
    login: {
      method: 'POST' as const,
      path: '/api/auth/login' as const,
      input: loginSchema,
      responses: {
        200: z.object({ 
          token: z.string(), 
          user: z.custom<typeof users.$inferSelect>() 
        }),
        401: errorSchemas.unauthorized,
      }
    },
    register: {
      method: 'POST' as const,
      path: '/api/auth/register' as const,
      input: registerSchema,
      responses: {
        201: z.object({ 
          token: z.string(), 
          user: z.custom<typeof users.$inferSelect>() 
        }),
        400: errorSchemas.validation,
      }
    },
    me: {
      method: 'GET' as const,
      path: '/api/auth/me' as const,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      }
    },
    updateSettings: {
      method: 'PATCH' as const,
      path: '/api/auth/settings' as const,
      input: z.object({ language: z.enum(['fr', 'en']) }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      }
    }
  },
  applications: {
    list: {
      method: 'GET' as const,
      path: '/api/applications' as const,
      responses: {
        200: z.array(z.custom<typeof applications.$inferSelect>()),
      }
    },
    create: {
      method: 'POST' as const,
      path: '/api/applications' as const,
      input: insertApplicationSchema,
      responses: {
        201: z.custom<typeof applications.$inferSelect>(),
      }
    },
    get: {
      method: 'GET' as const,
      path: '/api/applications/:id' as const,
      responses: {
        200: z.custom<typeof applications.$inferSelect>(),
        404: errorSchemas.notFound,
      }
    }
  },
  services: {
    list: {
      method: 'GET' as const,
      path: '/api/services' as const,
      input: z.object({ 
        applicationId: z.coerce.number().optional(), 
        isGlobal: z.enum(['true', 'false']).optional() 
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof services.$inferSelect>()),
      }
    },
    create: {
      method: 'POST' as const,
      path: '/api/services' as const,
      input: insertServiceSchema,
      responses: {
        201: z.custom<typeof services.$inferSelect>(),
      }
    },
    update: {
      method: 'PUT' as const,
      path: '/api/services/:id' as const,
      input: insertServiceSchema.partial(),
      responses: {
        200: z.custom<typeof services.$inferSelect>(),
        404: errorSchemas.notFound,
      }
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/services/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      }
    }
  },
  users: {
    list: {
      method: 'GET' as const,
      path: '/api/users' as const,
      input: z.object({ applicationId: z.coerce.number().optional() }).optional(),
      responses: {
        200: z.array(z.custom<typeof users.$inferSelect>()),
      }
    }
  },
  settings: {
    getReminders: {
      method: 'GET' as const,
      path: '/api/settings/reminders' as const,
      responses: {
        200: z.custom<typeof reminderSettings.$inferSelect>().nullable(),
      }
    },
    updateReminders: {
      method: 'PUT' as const,
      path: '/api/settings/reminders' as const,
      input: insertReminderSettingsSchema.partial(),
      responses: {
        200: z.custom<typeof reminderSettings.$inferSelect>(),
      }
    }
  },
  analytics: {
    dashboard: {
      method: 'GET' as const,
      path: '/api/analytics/dashboard' as const,
      input: z.object({ applicationId: z.coerce.number().optional() }).optional(),
      responses: {
        200: z.object({
          monthlyTotal: z.number(),
          yearlyTotal: z.number(),
          activeServices: z.number(),
          upcomingPayments: z.array(z.custom<typeof services.$inferSelect>()),
          expensesByMonth: z.array(z.object({ month: z.string(), amount: z.number() })),
          expensesByCategory: z.array(z.object({ category: z.string(), amount: z.number() })),
          expensesByApp: z.array(z.object({ appName: z.string(), amount: z.number() })),
          burnRate: z.number(),
          projection12Months: z.number()
        })
      }
    }
  },
  export: {
    pdf: {
      method: 'GET' as const,
      path: '/api/export/pdf' as const,
      input: z.object({ applicationId: z.coerce.number().optional() }).optional(),
      responses: {
        // Returns a binary PDF file stream, so we use any
        200: z.any(),
        403: errorSchemas.forbidden,
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type AuthResponse = z.infer<typeof api.auth.login.responses[200]>;
export type DashboardResponse = z.infer<typeof api.analytics.dashboard.responses[200]>;
