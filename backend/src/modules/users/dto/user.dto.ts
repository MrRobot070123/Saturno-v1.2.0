import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { RoleName } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  fullName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña temporal debe tener al menos 8 caracteres' })
  password: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Debe asignarse al menos un rol' })
  @IsEnum(RoleName, { each: true })
  roles: RoleName[];

  @IsOptional()
  @IsUUID()
  areaId?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(RoleName, { each: true })
  roles?: RoleName[];

  @IsOptional()
  @IsUUID()
  areaId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class PaginationQueryDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page = 1;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  pageSize = 20;

  @IsOptional()
  @IsString()
  search?: string;
}
