import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { MAX_INT32 } from '../users/users.dto';
import { AUDIT_PURPOSE, AUDIT_STATUS } from './audit-status';

export const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
/** Chuỗi rỗng sau khi trim = không gửi (để @IsOptional bỏ qua). */
const blankToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class ListAuditsQuery {
  @IsOptional()
  @IsIn(Object.values(AUDIT_STATUS), { message: 'Trạng thái không hợp lệ' })
  status?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  q?: string;
}

export class CreateAuditDto {
  /** null = đơn vị "Kho". Bắt buộc gửi: thiếu (undefined) → 400. */
  @ValidateIf((o: CreateAuditDto) => o.departmentId !== null)
  @IsDefined({ message: 'Vui lòng chọn đơn vị kiểm kê' })
  @IsInt({ message: 'Đơn vị kiểm kê không hợp lệ' })
  @Min(1, { message: 'Đơn vị kiểm kê không hợp lệ' })
  @Max(MAX_INT32, { message: 'Đơn vị kiểm kê không hợp lệ' })
  departmentId!: number | null;

  @IsDateString({}, { message: 'Ngày kiểm kê không hợp lệ' })
  dueDate!: string;

  @IsIn(Object.values(AUDIT_PURPOSE), { message: 'Mục đích không hợp lệ' })
  purpose!: string;

  @IsOptional()
  @IsInt({ message: 'Loại thiết bị không hợp lệ' })
  @Min(1, { message: 'Loại thiết bị không hợp lệ' })
  @Max(MAX_INT32, { message: 'Loại thiết bị không hợp lệ' })
  deviceTypeId?: number;

  @IsOptional()
  @Transform(blankToUndefined)
  @IsString()
  @MaxLength(150)
  location?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique({ message: 'Danh sách thành viên bị trùng' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'Thành viên không hợp lệ' })
  @Min(1, { each: true, message: 'Thành viên không hợp lệ' })
  @Max(MAX_INT32, { each: true, message: 'Thành viên không hợp lệ' })
  memberIds?: number[];
}
