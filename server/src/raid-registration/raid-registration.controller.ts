import { 
  Controller, 
  Get, 
  Post, 
  Delete, 
  Body, 
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Res
} from '@nestjs/common'
import { Response } from 'express'
import { RaidRegistrationService, CreateRaidRegistrationDto, RaidRegistration, GroupWarning } from './raid-registration.service'

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
   * 获取所有报名记录（需要百业名称验证）
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Query('baiye_name') baiyeName?: string): Promise<{ code: number; msg: string; data: RaidRegistration[]; warnings: GroupWarning[] }> {
    try {
      // 如果提供了百业名称，则按百业名称筛选
      if (baiyeName) {
        const { data, warnings } = await this.service.findByBaiyeName(baiyeName)
        return { code: 200, msg: '获取成功', data, warnings }
      }
      // 否则返回所有记录（保留原有行为，用于管理）
      const { data, warnings } = await this.service.findAll()
      return { code: 200, msg: '获取成功', data, warnings }
    } catch (error) {
      return { code: 400, msg: error.message, data: [], warnings: [] }
    }
  }

  /**
   * 获取所有百业名称列表
   */
  @Get('baiye-names')
  @HttpCode(HttpStatus.OK)
  async findAllBaiyeNames(): Promise<{ code: number; msg: string; data: string[] }> {
    try {
      const data = await this.service.findAllBaiyeNames()
      return { code: 200, msg: '获取成功', data }
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

  /**
   * 导出Excel统计
   */
  @Get('export/excel')
  async exportExcel(
    @Query('baiye_name') baiyeName: string,
    @Res() res: Response
  ): Promise<void> {
    try {
      const buffer = await this.service.exportExcel(baiyeName)
      const baiyeSuffix = baiyeName ? `_${baiyeName}` : ''
      const filename = `活动报名统计${baiyeSuffix}_${new Date().toISOString().split('T')[0]}.xlsx`
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
      res.setHeader('Content-Length', buffer.length)
      res.send(buffer)
    } catch (error) {
      res.status(400).json({ code: 400, msg: error.message })
    }
  }
}
