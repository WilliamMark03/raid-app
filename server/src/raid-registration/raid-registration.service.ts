import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '@/storage/database/supabase-client'

export interface CreateRaidRegistrationDto {
  player_id: string
  school: string
  is_commander: boolean
  raid_date: string
  raid_time_slot: string
}

export interface RaidRegistration {
  id: number
  player_id: string
  school: string
  is_commander: boolean
  raid_date: string
  raid_time_slot: string
  group_number: number
  created_at: string
  updated_at: string
}

@Injectable()
export class RaidRegistrationService {
  private getClient() {
    return getSupabaseClient()
  }

  /**
   * 创建报名记录
   */
  async create(dto: CreateRaidRegistrationDto): Promise<RaidRegistration> {
    const client = this.getClient()
    
    // 检查是否已存在相同玩家同一时间的报名
    const { data: existing, error: checkError } = await client
      .from('raid_registrations')
      .select('id')
      .eq('player_id', dto.player_id)
      .eq('raid_date', dto.raid_date)
      .eq('raid_time_slot', dto.raid_time_slot)
      .maybeSingle()

    if (checkError) {
      throw new Error(`检查重复报名失败: ${checkError.message}`)
    }

    if (existing) {
      throw new Error('该玩家已在此时间段报名')
    }

    // 插入新记录
    const { data, error } = await client
      .from('raid_registrations')
      .insert({
        player_id: dto.player_id,
        school: dto.school,
        is_commander: dto.is_commander || false,
        raid_date: dto.raid_date,
        raid_time_slot: dto.raid_time_slot,
        group_number: 0
      })
      .select()
      .single()

    if (error) {
      throw new Error(`创建报名失败: ${error.message}`)
    }

    // 更新分组号
    await this.updateGroupNumbers(dto.raid_date, dto.raid_time_slot)

    // 重新获取更新后的记录
    const { data: updatedData, error: fetchError } = await client
      .from('raid_registrations')
      .select('*')
      .eq('id', data.id)
      .single()

    if (fetchError) {
      throw new Error(`获取更新后记录失败: ${fetchError.message}`)
    }

    return updatedData as RaidRegistration
  }

  /**
   * 获取所有报名记录
   */
  async findAll(): Promise<RaidRegistration[]> {
    const client = this.getClient()
    
    const { data, error } = await client
      .from('raid_registrations')
      .select('*')
      .order('raid_date', { ascending: true })
      .order('raid_time_slot', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error(`获取报名列表失败: ${error.message}`)
    }

    // 更新所有分组
    await this.updateAllGroupNumbers()

    // 重新获取
    const { data: updatedData, error: fetchError } = await client
      .from('raid_registrations')
      .select('*')
      .order('raid_date', { ascending: true })
      .order('raid_time_slot', { ascending: true })
      .order('created_at', { ascending: true })

    if (fetchError) {
      throw new Error(`获取更新后列表失败: ${fetchError.message}`)
    }

    return updatedData as RaidRegistration[]
  }

  /**
   * 删除报名记录
   */
  async remove(id: number): Promise<void> {
    const client = this.getClient()
    
    // 先获取要删除的记录信息
    const { data: record, error: fetchError } = await client
      .from('raid_registrations')
      .select('raid_date, raid_time_slot')
      .eq('id', id)
      .single()

    if (fetchError) {
      throw new Error(`获取记录失败: ${fetchError.message}`)
    }

    // 删除记录
    const { error } = await client
      .from('raid_registrations')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(`删除报名失败: ${error.message}`)
    }

    // 更新分组
    if (record) {
      await this.updateGroupNumbers(record.raid_date, record.raid_time_slot)
    }
  }

  /**
   * 更新指定日期时段的分组号
   */
  private async updateGroupNumbers(raidDate: string, timeSlot: string): Promise<void> {
    const client = this.getClient()
    
    // 获取该时段的所有记录
    const { data: records, error } = await client
      .from('raid_registrations')
      .select('id')
      .eq('raid_date', raidDate)
      .eq('raid_time_slot', timeSlot)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('获取记录失败:', error)
      return
    }

    if (!records || records.length === 0) {
      return
    }

    // 更新每条记录的组号（每10人一组）
    for (let i = 0; i < records.length; i++) {
      const groupNumber = Math.floor(i / 10) + 1
      await client
        .from('raid_registrations')
        .update({ group_number: groupNumber })
        .eq('id', records[i].id)
    }
  }

  /**
   * 更新所有分组号
   */
  private async updateAllGroupNumbers(): Promise<void> {
    const client = this.getClient()
    
    // 获取所有不同的日期+时段组合
    const { data: records, error } = await client
      .from('raid_registrations')
      .select('raid_date, raid_time_slot')

    if (error || !records) {
      return
    }

    // 去重
    const uniqueCombinations = new Set(
      records.map(r => `${r.raid_date}_${r.raid_time_slot}`)
    )

    // 更新每个组合的分组
    for (const combo of uniqueCombinations) {
      const [date, timeSlot] = combo.split('_')
      await this.updateGroupNumbers(date, timeSlot)
    }
  }

  /**
   * 导出Excel统计数据
   */
  async exportExcel(): Promise<Buffer> {
    const XLSX = await import('xlsx')
    const client = this.getClient()
    
    // 更新所有分组
    await this.updateAllGroupNumbers()
    
    // 获取所有记录
    const { data, error } = await client
      .from('raid_registrations')
      .select('*')
      .order('raid_date', { ascending: true })
      .order('raid_time_slot', { ascending: true })
      .order('group_number', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error(`获取数据失败: ${error.message}`)
    }

    // 转换为Excel数据格式
    const excelData = (data as RaidRegistration[]).map((item, index) => ({
      '序号': index + 1,
      '玩家ID': item.player_id,
      '流派': item.school,
      '是否指挥': item.is_commander ? '是' : '否',
      '打本日期': item.raid_date,
      '时间': item.raid_time_slot,
      '组号': item.group_number,
      '报名时间': new Date(item.created_at).toLocaleString('zh-CN')
    }))

    // 创建工作簿
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(excelData)
    
    // 设置列宽
    worksheet['!cols'] = [
      { wch: 6 },   // 序号
      { wch: 15 },  // 玩家ID
      { wch: 10 },  // 流派
      { wch: 10 },  // 是否指挥
      { wch: 12 },  // 打本日期
      { wch: 12 },  // 时间
      { wch: 6 },   // 组号
      { wch: 20 },  // 报名时间
    ]
    
    XLSX.utils.book_append_sheet(workbook, worksheet, '报名统计')
    
    // 生成Buffer
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  }
}
