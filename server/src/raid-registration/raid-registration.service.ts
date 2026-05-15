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

export interface GroupWarning {
  raid_date: string
  raid_time_slot: string
  group_number: number
  linlin_count: number
  warning: string
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
  async findAll(): Promise<{ data: RaidRegistration[], warnings: GroupWarning[] }> {
    const client = this.getClient()
    
    // 更新所有分组并获取警告
    const warnings = await this.updateAllGroupNumbers()

    // 重新获取
    const { data: updatedData, error: fetchError } = await client
      .from('raid_registrations')
      .select('*')
      .order('raid_date', { ascending: true })
      .order('raid_time_slot', { ascending: true })
      .order('group_number', { ascending: true })
      .order('created_at', { ascending: true })

    if (fetchError) {
      throw new Error(`获取更新后列表失败: ${fetchError.message}`)
    }

    return { data: updatedData as RaidRegistration[], warnings }
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
   * 更新指定日期时段的分组号（考虑霖霖分配规则）
   */
  private async updateGroupNumbers(raidDate: string, timeSlot: string): Promise<GroupWarning[]> {
    const client = this.getClient()
    
    // 获取该时段的所有记录
    const { data: records, error } = await client
      .from('raid_registrations')
      .select('id, school')
      .eq('raid_date', raidDate)
      .eq('raid_time_slot', timeSlot)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('获取记录失败:', error)
      return []
    }

    if (!records || records.length === 0) {
      return []
    }

    // 计算需要的组数（每10人一组）
    const totalPeople = records.length
    const groupCount = Math.ceil(totalPeople / 10)

    // 区分霖霖和非霖霖
    const linlinRecords: { id: number, school: string }[] = []
    const otherRecords: { id: number, school: string }[] = []

    for (const record of records) {
      if (record.school === '霖霖') {
        linlinRecords.push(record)
      } else {
        otherRecords.push(record)
      }
    }

    const linlinCount = linlinRecords.length
    const warnings: GroupWarning[] = []

    // 为每个人分配组号
    const assignments: { id: number, groupNumber: number }[] = []
    
    // 1. 先分配霖霖（每组最多2个）
    let linlinIndex = 0
    for (let g = 1; g <= groupCount; g++) {
      // 每组分配最多2个霖霖
      for (let i = 0; i < 2 && linlinIndex < linlinRecords.length; i++) {
        assignments.push({
          id: linlinRecords[linlinIndex].id,
          groupNumber: g
        })
        linlinIndex++
      }
    }

    // 2. 分配非霖霖成员
    let otherIndex = 0
    for (let g = 1; g <= groupCount && otherIndex < otherRecords.length; g++) {
      // 计算该组已有多少霖霖
      const groupLinlinCount = assignments.filter(a => a.groupNumber === g).length
      const slotsAvailable = 10 - groupLinlinCount
      
      // 填充非霖霖成员
      for (let i = 0; i < slotsAvailable && otherIndex < otherRecords.length; i++) {
        assignments.push({
          id: otherRecords[otherIndex].id,
          groupNumber: g
        })
        otherIndex++
      }
    }

    // 3. 如果还有剩余的非霖霖成员（理论上不应该发生，因为组数是按总人数算的）
    while (otherIndex < otherRecords.length) {
      const groupNum = (otherIndex % groupCount) + 1
      assignments.push({
        id: otherRecords[otherIndex].id,
        groupNumber: groupNum
      })
      otherIndex++
    }

    // 4. 检查每组的霖霖数量，生成警告
    for (let g = 1; g <= groupCount; g++) {
      const groupLinlin = assignments.filter(a => a.groupNumber === g).filter(a => {
        const record = linlinRecords.find(r => r.id === a.id)
        return record !== undefined
      }).length

      if (groupLinlin < 2) {
        const groupTotal = assignments.filter(a => a.groupNumber === g).length
        if (groupTotal > 0) { // 只有非空组才警告
          warnings.push({
            raid_date: raidDate,
            raid_time_slot: timeSlot,
            group_number: g,
            linlin_count: groupLinlin,
            warning: groupLinlin === 0 
              ? '该组缺少霖霖，请补充' 
              : '该组霖霖仅1人，建议补充'
          })
        }
      }
    }

    // 5. 更新数据库中的组号
    for (const assignment of assignments) {
      await client
        .from('raid_registrations')
        .update({ group_number: assignment.groupNumber })
        .eq('id', assignment.id)
    }

    return warnings
  }

  /**
   * 更新所有分组号
   */
  private async updateAllGroupNumbers(): Promise<GroupWarning[]> {
    const client = this.getClient()
    
    // 获取所有不同的日期+时段组合
    const { data: records, error } = await client
      .from('raid_registrations')
      .select('raid_date, raid_time_slot')

    if (error || !records) {
      return []
    }

    // 去重
    const uniqueCombinations = new Set(
      records.map(r => `${r.raid_date}_${r.raid_time_slot}`)
    )

    // 更新每个组合的分组，收集所有警告
    const allWarnings: GroupWarning[] = []
    for (const combo of uniqueCombinations) {
      const [date, timeSlot] = combo.split('_')
      const warnings = await this.updateGroupNumbers(date, timeSlot)
      allWarnings.push(...warnings)
    }

    return allWarnings
  }

  /**
   * 导出Excel统计数据
   */
  async exportExcel(): Promise<Buffer> {
    const XLSX = await import('xlsx')
    const client = this.getClient()
    
    // 更新所有分组并获取警告
    const warnings = await this.updateAllGroupNumbers()
    
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
    const excelData = data.map((record, index) => {
      // 检查该记录所在组是否有警告
      const groupWarning = warnings.find(w => 
        w.raid_date === record.raid_date && 
        w.raid_time_slot === record.raid_time_slot && 
        w.group_number === record.group_number
      )

      return {
        '序号': index + 1,
        '玩家ID': record.player_id,
        '流派': record.school,
        '是否指挥': record.is_commander ? '是' : '否',
        '打本日期': record.raid_date,
        '时间': record.raid_time_slot,
        '组号': record.group_number,
        '分组提醒': groupWarning ? groupWarning.warning : '',
        '报名时间': new Date(record.created_at).toLocaleString('zh-CN')
      }
    })

    // 创建工作簿
    const worksheet = XLSX.utils.json_to_sheet(excelData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '报名统计')

    // 设置列宽
    worksheet['!cols'] = [
      { wch: 6 },   // 序号
      { wch: 15 },  // 玩家ID
      { wch: 10 },  // 流派
      { wch: 10 },  // 是否指挥
      { wch: 12 },  // 打本日期
      { wch: 12 },  // 时间
      { wch: 6 },   // 组号
      { wch: 25 },  // 分组提醒
      { wch: 20 }   // 报名时间
    ]

    // 生成Buffer
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  }
}
