import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MAX_INT32 } from '../users/users.dto';
import { TRANSFER_STATUS } from './device-transfer-status';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ListDeviceTransfersQuery {
  @IsOptional()
  @IsIn(Object.values(TRANSFER_STATUS), { message: 'Trạng thái không hợp lệ' })
  status?: string;
}

export class CreateDeviceTransferDto {
  @Type(() => Number)
  @IsInt({ message: 'Người dùng không hợp lệ' })
  @Min(1, { message: 'Người dùng không hợp lệ' })
  @Max(MAX_INT32, { message: 'Người dùng không hợp lệ' })
  fromUserId!: number;

  @Type(() => Number)
  @IsInt({ message: 'Người dùng không hợp lệ' })
  @Min(1, { message: 'Người dùng không hợp lệ' })
  @Max(MAX_INT32, { message: 'Người dùng không hợp lệ' })
  toUserId!: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  note?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Vui lòng chọn ít nhất 1 thiết bị' })
  @ArrayUnique({ message: 'Danh sách thiết bị bị trùng' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'Thiết bị không hợp lệ' })
  @Min(1, { each: true, message: 'Thiết bị không hợp lệ' })
  @Max(MAX_INT32, { each: true, message: 'Thiết bị không hợp lệ' })
  deviceIds!: number[];
}

export class RejectDeviceTransferDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập lý do từ chối' })
  @MaxLength(255)
  reason!: string;
}
