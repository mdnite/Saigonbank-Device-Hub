import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { MAX_INT32 } from '../users/users.dto';
import { AUDIT_PURPOSE, AUDIT_RESULT, AUDIT_STATUS } from './audit-status';

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

export class UpdateAuditLineDto {
  @IsOptional()
  @IsIn(Object.values(AUDIT_RESULT), {
    message: 'Kết quả kiểm kê không hợp lệ',
  })
  result?: string;

  /** Chuỗi rỗng = xoá ghi chú (lưu null). */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsString()
  @MaxLength(255)
  note?: string | null;
}

export class SetAuditMembersDto {
  @IsArray()
  @ArrayUnique({ message: 'Danh sách thành viên bị trùng' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'Thành viên không hợp lệ' })
  @Min(1, { each: true, message: 'Thành viên không hợp lệ' })
  @Max(MAX_INT32, { each: true, message: 'Thành viên không hợp lệ' })
  userIds!: number[];
}

export class RejectAuditDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập lý do từ chối' })
  @MaxLength(255)
  reason!: string;
}

export class CreateAuditSummaryDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tiêu đề' })
  @MaxLength(150)
  title!: string;

  @IsOptional()
  @IsIn(Object.values(AUDIT_PURPOSE), { message: 'Mục đích không hợp lệ' })
  purpose?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Vui lòng chọn ít nhất 1 đợt kiểm kê' })
  @ArrayUnique({ message: 'Danh sách đợt kiểm kê bị trùng' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'Đợt kiểm kê không hợp lệ' })
  @Min(1, { each: true, message: 'Đợt kiểm kê không hợp lệ' })
  @Max(MAX_INT32, { each: true, message: 'Đợt kiểm kê không hợp lệ' })
  auditIds!: number[];
}
