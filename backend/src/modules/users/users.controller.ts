import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthedRequest } from '../../shared/auth/auth.guard';
import { Roles } from '../../shared/auth/roles.decorator';
import { ResponseMessage } from '../../shared/http/api-response';
import { ROLE } from '../identity/roles';
import {
  CreateUserDto,
  ListUsersQuery,
  UpdateUserStatusDto,
} from './users.dto';
import { USER_NOT_FOUND, UsersService } from './users.service';

// id không phải số coi như user không tồn tại, thay cho message tiếng Anh mặc định của ParseIntPipe.
const UserId = () =>
  Param(
    'id',
    new ParseIntPipe({
      exceptionFactory: () => new NotFoundException(USER_NOT_FOUND),
    }),
  );

@Controller('users')
@UseGuards(AuthGuard)
@Roles(ROLE.ADMIN)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query() query: ListUsersQuery) {
    return this.users.list(query);
  }

  @Post()
  @ResponseMessage('Đã tạo người dùng')
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id/status')
  @ResponseMessage('Đã cập nhật trạng thái')
  updateStatus(
    @Req() req: AuthedRequest,
    @UserId() id: number,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.users.updateStatus(req.user.id, id, dto.status);
  }

  @Delete(':id')
  @ResponseMessage('Đã xoá người dùng')
  remove(@Req() req: AuthedRequest, @UserId() id: number) {
    return this.users.softDelete(req.user.id, id);
  }
}

/** Danh mục cho dropdown — mọi user đã đăng nhập đều đọc được. */
@Controller()
@UseGuards(AuthGuard)
export class LookupController {
  constructor(private readonly users: UsersService) {}

  @Get('roles')
  roles() {
    return this.users.roles();
  }

  @Get('departments')
  departments() {
    return this.users.departments();
  }

  // Đặt ở controller không có prefix (không phải UsersController) nên đường dẫn đầy đủ là
  // /users/lookup mà vẫn giữ guard "chỉ cần đăng nhập". UsersController không khai báo
  // GET ':id' nào nên không có route tham số nào nuốt mất /users/lookup.
  @Get('users/lookup')
  userLookup() {
    return this.users.userLookup();
  }
}
