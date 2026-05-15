import { 
  Controller, 
  Get, 
  Post, 
  Delete, 
  Body, 
  Param,
  HttpCode,
  HttpStatus
} from '@nestjs/common'
import { RaidRegistrationService, CreateRaidRegistrationDto, RaidRegistration } from './raid-registration.service'

@Controller('raid-registrations')
export class RaidRegistrationController {
  constructor(private readonly service: RaidRegistrationService) {}

  /**
   * 创建报名
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async create(@Body() dto: CreateRaidRegistrationDto): Promise<{ code: number; msg: string; data: RaidRegistration | null }> {
    try {
      const result = await this.service.create(dto)
      return { code: 200, msg: '报名成功', data: result }
    } catch (error) {
      return { code: 400, msg: error.message, data: null }
    }
  }

  /**
   * 获取所有报名记录
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(): Promise<{ code: number; msg: string; data: RaidRegistration[] }> {
    try {
      const result = await this.service.findAll()
      return { code: 200, msg: '获取成功', data: result }
    } catch (error) {
      return { code: 400, msg: error.message, data: [] }
    }
  }

  /**
   * 删除报名
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string): Promise<{ code: number; msg: string }> {
    try {
      await this.service.remove(Number(id))
      return { code: 200, msg: '删除成功' }
    } catch (error) {
      return { code: 400, msg: error.message }
    }
  }
}
