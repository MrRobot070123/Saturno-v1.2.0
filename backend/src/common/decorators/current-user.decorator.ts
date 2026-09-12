import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  hotelId: string;
  roles: string[];
  permissions: string[];
}

// Uso: create(@CurrentUser() user: AuthenticatedUser)
// El campo "usuario que registra" del caso NUNCA se acepta del body del
// request: siempre se toma de aquí (regla #7 del proyecto).
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;
    return data ? user?.[data] : user;
  },
);
