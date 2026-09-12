import { Body, Controller, Ip, Post, Req, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  ChangePasswordDto,
  LoginDto,
  RefreshTokenDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
} from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // Rate limiting propio y más estricto sobre login para mitigar fuerza bruta,
  // además del throttling global (regla #31).
  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.authService.login(dto.email, dto.password, ip);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto, @Ip() ip: string) {
    return this.authService.refresh(dto.refreshToken, ip);
  }

  @Post('logout')
  logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RefreshTokenDto,
    @Ip() ip: string,
  ) {
    return this.authService.logout(user.userId, dto.refreshToken, ip);
  }

  @Post('change-password')
  changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.userId, dto.currentPassword, dto.newPassword);
  }

  @Public()
  @Post('request-password-reset')
  requestReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Public()
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }
}
