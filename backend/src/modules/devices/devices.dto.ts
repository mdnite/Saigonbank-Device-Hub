import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_INT32 } from '../users/users.dto';
import {
  ASSIGNABLE_DEVICE_STATUSES,
  DEVICE_CODE_MESSAGE,
  DEVICE_CODE_PATTERN,
  DEVICE_STATUS,
} from './device-status';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class AccessoryDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mã linh kiện' })
  @MaxLength(50)
  accessoryCode!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên linh kiện' })
  @MaxLength(150)
  accessoryName!: string;

  @Transform(trim)
  @IsString()
  @MaxLength(100)
  accessoryType!: string;

  @Transform(trim)
  @IsString()
  @MaxLength(20)
  unit!: string;
}

export class ListDevicesQuery {
  @IsOptional()
  @IsString()
  search?: string;

  // Lọc danh sách chấp nhận cả "Đã xóa" — khác với PATCH (ASSIGNABLE_DEVICE_STATUSES) vốn cấm đặt nó.
  @IsOptional()
  @IsIn(Object.values(DEVICE_STATUS), { message: 'Trạng thái không hợp lệ' })
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Loại thiết bị không hợp lệ' })
  @Min(1, { message: 'Loại thiết bị không hợp lệ' })
  @Max(MAX_INT32, { message: 'Loại thiết bị không hợp lệ' })
  deviceTypeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Phòng ban không hợp lệ' })
  @Min(1, { message: 'Phòng ban không hợp lệ' })
  @Max(MAX_INT32, { message: 'Phòng ban không hợp lệ' })
  departmentId?: number;
}

export class PurgeDevicesDto {
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(MAX_INT32, { each: true })
  ids!: number[];
}

export class CreateDeviceDto {
  @Transform(upper)
  @IsString()
  @Matches(DEVICE_CODE_PATTERN, { message: DEVICE_CODE_MESSAGE })
  deviceCode!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên thiết bị' })
  @MaxLength(150)
  deviceName!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập cấu hình chi tiết' })
  @MaxLength(255)
  specDetail!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập đơn vị tính' })
  @MaxLength(20)
  unit!: string;

  @IsInt({ message: 'Vui lòng chọn loại thiết bị' })
  @Min(1, { message: 'Loại thiết bị không hợp lệ' })
  @Max(MAX_INT32, { message: 'Loại thiết bị không hợp lệ' })
  deviceTypeId!: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  serialNumber?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  location?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày mua không hợp lệ' })
  purchaseDate?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  supplier?: string;

  @IsOptional()
  @IsInt({ message: 'Thời gian bảo hành không hợp lệ' })
  @Min(0, { message: 'Thời gian bảo hành không hợp lệ' })
  @Max(MAX_INT32, { message: 'Thời gian bảo hành không hợp lệ' })
  warrantyMonths?: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  warrantyCondition?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Hạn bảo hành không hợp lệ' })
  warrantyExpiresOn?: string;

  @IsOptional()
  @IsInt({ message: 'Phòng ban không hợp lệ' })
  @Min(1, { message: 'Phòng ban không hợp lệ' })
  @Max(MAX_INT32, { message: 'Phòng ban không hợp lệ' })
  departmentId?: number;

  @IsOptional()
  @IsInt({ message: 'Người sở hữu không hợp lệ' })
  @Min(1, { message: 'Người sở hữu không hợp lệ' })
  @Max(MAX_INT32, { message: 'Người sở hữu không hợp lệ' })
  currentUserId?: number;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày cấp phát không hợp lệ' })
  allocatedOn?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccessoryDto)
  accessories?: AccessoryDto[];
}

/** Mọi trường của Create ở dạng optional, cộng thêm status (3 giá trị). */
export class UpdateDeviceDto {
  @IsOptional()
  @Transform(upper)
  @IsString()
  @Matches(DEVICE_CODE_PATTERN, { message: DEVICE_CODE_MESSAGE })
  deviceCode?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên thiết bị' })
  @MaxLength(150)
  deviceName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập cấu hình chi tiết' })
  @MaxLength(255)
  specDetail?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập đơn vị tính' })
  @MaxLength(20)
  unit?: string;

  @IsOptional()
  @IsInt({ message: 'Loại thiết bị không hợp lệ' })
  @Min(1, { message: 'Loại thiết bị không hợp lệ' })
  @Max(MAX_INT32, { message: 'Loại thiết bị không hợp lệ' })
  deviceTypeId?: number;

  @IsOptional()
  @IsIn([...ASSIGNABLE_DEVICE_STATUSES], { message: 'Trạng thái không hợp lệ' })
  status?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  serialNumber?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  location?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày mua không hợp lệ' })
  purchaseDate?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  supplier?: string;

  @IsOptional()
  @IsInt({ message: 'Thời gian bảo hành không hợp lệ' })
  @Min(0, { message: 'Thời gian bảo hành không hợp lệ' })
  @Max(MAX_INT32, { message: 'Thời gian bảo hành không hợp lệ' })
  warrantyMonths?: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  warrantyCondition?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Hạn bảo hành không hợp lệ' })
  warrantyExpiresOn?: string;

  @IsOptional()
  @IsInt({ message: 'Phòng ban không hợp lệ' })
  @Min(1, { message: 'Phòng ban không hợp lệ' })
  @Max(MAX_INT32, { message: 'Phòng ban không hợp lệ' })
  departmentId?: number;

  @IsOptional()
  @IsInt({ message: 'Người sở hữu không hợp lệ' })
  @Min(1, { message: 'Người sở hữu không hợp lệ' })
  @Max(MAX_INT32, { message: 'Người sở hữu không hợp lệ' })
  currentUserId?: number;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày cấp phát không hợp lệ' })
  allocatedOn?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccessoryDto)
  accessories?: AccessoryDto[];
}
