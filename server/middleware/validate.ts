import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'خطای اعتبارسنجی اطلاعات',
          details: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
        });
      }
      next(error);
    }
  };
}
