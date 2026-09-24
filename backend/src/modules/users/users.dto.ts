import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PASSWORD_MIN_LENGTH } from '../identity/auth.dto';
import { USER_STATUS } from '../identity/user-status';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
// Cột Int của Postgres là int4: số lớn hơn khiến Prisma ném lỗi (500) thay vì báo sai dữ liệu.
export const MAX_INT32 = 2_147_483_647;
const STATUS_MESSAGE = 'Trạng thái không hợp lệ';

export class ListUsersQuery {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(Object.values(USER_STATUS), { message: STATUS_MESSAGE })
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Vai trò không hợp lệ' })
  @Min(1, { message: 'Vai trò không hợp lệ' })
  @Max(MAX_INT32, { message: 'Vai trò không hợp lệ' })
  roleId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Phòng ban không hợp lệ' })
  @Min(1, { message: 'Phòng ban không hợp lệ' })
  @Max(MAX_INT32, { message: 'Phòng ban không hợp lệ' })
  departmentId?: number;
}

export class CreateUserDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên đăng nhập' })
  @MaxLength(100)
  username!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(150)
  email!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập họ tên' })
  @MaxLength(150)
  fullName!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`,
  })
  password!: string;

  @IsInt({ message: 'Vui lòng chọn vai trò' })
  @Min(1, { message: 'Vai trò không hợp lệ' })
  @Max(MAX_INT32, { message: 'Vai trò không hợp lệ' })
  roleId!: number;

  @IsOptional()
  @IsInt({ message: 'Phòng ban không hợp lệ' })
  @Min(1, { message: 'Phòng ban không hợp lệ' })
  @Max(MAX_INT32, { message: 'Phòng ban không hợp lệ' })
  departmentId?: number;
}

export class UpdateUserStatusDto {
  @IsIn([USER_STATUS.ACTIVE, USER_STATUS.INACTIVE], { message: STATUS_MESSAGE })
  status!: string;
}

export class PurgeUsersDto {
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(MAX_INT32, { each: true })
  ids!: number[];
}
