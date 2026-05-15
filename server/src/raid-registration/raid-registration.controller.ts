import { 
  Controller, 
  Get, 
  Post, 
  Delete, 
  Body, 
  Param,
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
   * 获取所有报名记录
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(): Promise<{ code: number; msg: string; data: RaidRegistration[]; warnings: GroupWarning[] }> {
    try {
      const { data, warnings } = await this.service.findAll()
      return { code: 200, msg: '获取成功', data, warnings }
    } catch (error) {
      return { code: 400, msg: error.message, data: [], warnings: [] }
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
  async exportExcel(@Res() res: Response): Promise<void> {
    try {
      const buffer = await this.service.exportExcel()
      const filename = `打本报名统计_${new Date().toISOString().split('T')[0]}.xlsx`
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
      res.setHeader('Content-Length', buffer.length)
      res.send(buffer)
    } catch (error) {
      res.status(400).json({ code: 400, msg: error.message })
    }
  }
}
