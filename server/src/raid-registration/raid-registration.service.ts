import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '@/storage/database/supabase-client'

export interface CreateRaidRegistrationDto {
  registration_type: string
  player_id: string
  school: string
  is_commander: boolean
  is_black_worker: boolean
  raid_date: string
  raid_time_slot: string
  team?: string // 小队：进攻组、防守组（百业战报名专用）
  baiye_name?: string // 百业名称：铁匠铺、药铺、酒楼等
  remark?: string // 备注
}

export interface RaidRegistration {
  id: number
  registration_type: string
  player_id: string
  school: string
  is_commander: boolean
  is_black_worker: boolean
  raid_date: string
  raid_time_slot: string
  team: string | null
  baiye_name: string | null
  remark: string | null
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
      .eq('registration_type', dto.registration_type || '打本报名')
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
        registration_type: dto.registration_type || '打本报名',
        player_id: dto.player_id,
        school: dto.school,
        is_commander: dto.is_commander || false,
        is_black_worker: dto.is_black_worker || false,
        raid_date: dto.raid_date,
        raid_time_slot: dto.raid_time_slot,
        team: dto.team || null,
        baiye_name: dto.baiye_name || null,
        remark: dto.remark || null,
        group_number: 0
      })
      .select()
      .single()

    if (error) {
      throw new Error(`创建报名失败: ${error.message}`)
    }

    // 打本报名才更新分组号
    if (dto.registration_type === '打本报名') {
      await this.updateGroupNumbers(dto.raid_date, dto.raid_time_slot)
    }
    
    // 百业战报名按日期和小队更新分组
    if (dto.registration_type === '百业战报名') {
      await this.updateBaiyeGroupNumbers(dto.raid_date, dto.team || null)
    }

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
   * 获取所有报名记录（自动过滤过期数据）
   */
  async findAll(): Promise<{ data: RaidRegistration[], warnings: GroupWarning[] }> {
    const client = this.getClient()
    
    // 先清理过期数据
    await this.cleanExpiredData()
    
    // 更新打本报名的分组并获取警告
    const warnings = await this.updateAllGroupNumbers()
    
    // 更新百业战报名的分组
    await this.updateAllBaiyeGroupNumbers()

    // 重新获取（只获取未来的数据）
    const today = new Date().toISOString().split('T')[0]
    const { data: updatedData, error: fetchError } = await client
      .from('raid_registrations')
      .select('*')
      .gte('raid_date', today)  // 只获取今天及以后的数据
      .order('registration_type', { ascending: true })
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
   * 根据百业名称获取报名记录（访问控制，自动过滤过期数据）
   */
  async findByBaiyeName(baiyeName: string): Promise<{ data: RaidRegistration[], warnings: GroupWarning[] }> {
    const client = this.getClient()
    
    // 先清理过期数据
    await this.cleanExpiredData()
    
    // 更新打本报名的分组并获取警告
    const warnings = await this.updateAllGroupNumbers()
    
    // 更新百业战报名的分组
    await this.updateAllBaiyeGroupNumbers()

    // 按百业名称筛选（只获取未来的数据）
    const today = new Date().toISOString().split('T')[0]
    const { data: updatedData, error: fetchError } = await client
      .from('raid_registrations')
      .select('*')
      .eq('baiye_name', baiyeName)
      .gte('raid_date', today)  // 只获取今天及以后的数据
      .order('registration_type', { ascending: true })
      .order('raid_date', { ascending: true })
      .order('raid_time_slot', { ascending: true })
      .order('group_number', { ascending: true })
      .order('created_at', { ascending: true })

    if (fetchError) {
      throw new Error(`获取数据失败: ${fetchError.message}`)
    }

    return { data: updatedData as RaidRegistration[], warnings }
  }

  /**
   * 清理过期数据（当日结束时清除当日及以前的报名内容）
   */
  async cleanExpiredData(): Promise<void> {
    const client = this.getClient()
    const today = new Date().toISOString().split('T')[0]
    
    // 删除今天之前的数据
    const { error } = await client
      .from('raid_registrations')
      .delete()
      .lt('raid_date', today)  // 删除 raid_date < 今天 的数据
    
    if (error) {
      console.error('清理过期数据失败:', error.message)
    }
  }

  /**
   * 获取所有百业名称列表（用于下拉选择）
   */
  async findAllBaiyeNames(): Promise<string[]> {
    const client = this.getClient()
    
    const { data, error } = await client
      .from('raid_registrations')
      .select('baiye_name')
      .not('baiye_name', 'is', null)

    if (error || !data) {
      return []
    }

    // 去重并返回
    const uniqueNames = [...new Set(data.map(r => r.baiye_name).filter(Boolean))]
    return uniqueNames as string[]
  }

  /**
   * 删除报名记录
   */
  async remove(id: number): Promise<void> {
    const client = this.getClient()
    
    // 先获取要删除的记录信息
    const { data: record, error: fetchError } = await client
      .from('raid_registrations')
      .select('raid_date, raid_time_slot, registration_type')
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

    // 打本报名才更新分组
    if (record && record.registration_type === '打本报名') {
      await this.updateGroupNumbers(record.raid_date, record.raid_time_slot)
    }
    
    // 百业战报名更新分组
    if (record && record.registration_type === '百业战报名') {
      await this.updateBaiyeGroupNumbers(record.raid_date, null)
    }
  }

  /**
   * 更新指定日期时段的分组号（考虑霖霖分配规则）- 仅用于打本报名
   */
  private async updateGroupNumbers(raidDate: string, timeSlot: string): Promise<GroupWarning[]> {
    const client = this.getClient()
    
    // 获取该时段的打本报名记录
    const { data: records, error } = await client
      .from('raid_registrations')
      .select('id, school')
      .eq('raid_date', raidDate)
      .eq('raid_time_slot', timeSlot)
      .eq('registration_type', '打本报名')
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

    // 3. 如果还有剩余的非霖霖成员
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
        if (groupTotal > 0) {
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
   * 更新所有分组号 - 仅更新打本报名
   */
  private async updateAllGroupNumbers(): Promise<GroupWarning[]> {
    const client = this.getClient()
    
    // 获取所有打本报名的不同日期+时段组合
    const { data: records, error } = await client
      .from('raid_registrations')
      .select('raid_date, raid_time_slot')
      .eq('registration_type', '打本报名')

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
   * 更新所有百业战报名的分组号（按日期和小队分组，无人数限制）
   */
  private async updateAllBaiyeGroupNumbers(): Promise<void> {
    const client = this.getClient()
    
    // 获取所有百业战报名的日期
    const { data: records, error } = await client
      .from('raid_registrations')
      .select('raid_date, team')
      .eq('registration_type', '百业战报名')

    if (error || !records || records.length === 0) {
      return
    }

    // 获取所有唯一的日期+小队组合
    const combinations = new Set<string>()
    records.forEach(r => {
      if (r.raid_date && r.team) {
        combinations.add(`${r.raid_date}_${r.team}`)
      }
    })

    // 更新每个组合的分组
    for (const combo of combinations) {
      const [date, team] = combo.split('_')
      await this.updateBaiyeGroupNumbers(date, team)
    }
  }

  /**
   * 更新指定日期和小队的百业战报名分组号（按报名时间排序，无人数限制）
   */
  private async updateBaiyeGroupNumbers(raidDate: string, specificTeam: string | null): Promise<void> {
    const client = this.getClient()
    
    // 获取该日期的百业战报名记录
    let query = client
      .from('raid_registrations')
      .select('id, team')
      .eq('raid_date', raidDate)
      .eq('registration_type', '百业战报名')
      .order('created_at', { ascending: true })

    const { data: records, error } = await query

    if (error || !records || records.length === 0) {
      return
    }

    // 按小队分组，每个小队内部按报名时间排序分配组号（组号固定为1，因为无人数限制）
    const teamGroups: { [key: string]: number[] } = {}
    records.forEach(r => {
      const team = r.team || '未分配'
      if (!teamGroups[team]) {
        teamGroups[team] = []
      }
      teamGroups[team].push(r.id)
    })

    // 更新每个小队的分组号（都设为1，表示该小队的成员）
    for (const [team, ids] of Object.entries(teamGroups)) {
      for (const id of ids) {
        await client
          .from('raid_registrations')
          .update({ group_number: 1 })
          .eq('id', id)
      }
    }
  }

  /**
   * 导出Excel统计数据
   * @param baiyeName 百业名称，用于筛选
   */
  async exportExcel(baiyeName?: string): Promise<Buffer> {
    const XLSX = await import('xlsx-js-style')
    const client = this.getClient()
    
    // 更新打本报名的分组并获取警告
    const warnings = await this.updateAllGroupNumbers()
    
    // 构建查询 - 支持按百业筛选
    let query = client
      .from('raid_registrations')
      .select('*')
    
    // 如果指定了百业名称，进行筛选
    if (baiyeName) {
      query = query.eq('baiye_name', baiyeName)
    }
    
    const { data, error } = await query
      .order('registration_type', { ascending: true })
      .order('raid_date', { ascending: true })
      .order('raid_time_slot', { ascending: true })
      .order('group_number', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error(`获取数据失败: ${error.message}`)
    }

    if (!data || data.length === 0) {
      throw new Error('没有可导出的数据')
    }

    // 流派颜色映射
    const getSchoolStyle = (school: string) => {
      const yellowStyle = { fill: { fgColor: { rgb: 'FFFFFF00' } } }  // 黄色
      const purpleStyle = { fill: { fgColor: { rgb: 'FFD8BFD8' } } }  // 紫色
      const greenStyle = { fill: { fgColor: { rgb: 'FF90EE90' } } }   // 浅绿色
      const blueStyle = { fill: { fgColor: { rgb: 'FFADD8E6' } } }    // 浅蓝色

      switch (school) {
        case '威威':
          return yellowStyle
        case '玉玉':
        case '虹虹':
        case '翊翊':
        case '尘尘':
          return purpleStyle
        case '霖霖':
          return greenStyle
        default:
          return blueStyle
      }
    }

    // 定义列名
    const headers = ['序号', '玩家ID', '流派', '是否指挥', '是否黑工', '时间', '小队', '组号', '分组提醒', '备注', '报名时间']
    
    // 创建工作簿
    const workbook = XLSX.utils.book_new()
    
    // 按报名类型+日期分组
    const groupedData = new Map<string, typeof data>()
    data.forEach(record => {
      const key = `${record.registration_type}_${record.raid_date}`
      if (!groupedData.has(key)) {
        groupedData.set(key, [])
      }
      groupedData.get(key)!.push(record)
    })
    
    // 为每个分组创建工作表
    let sheetIndex = 0
    for (const [key, records] of groupedData) {
      const [registrationType, raidDate] = key.split('_')
      
      // 工作表名称（截取前15个字符，避免超长）
      const sheetName = `${registrationType.substring(0, 8)}_${raidDate}`.substring(0, 31)
      
      // 创建工作表数据
      const wsData = [headers]
      
      // 添加数据行
      records.forEach((record, index) => {
        const groupWarning = record.registration_type === '打本报名' 
          ? warnings.find(w => 
              w.raid_date === record.raid_date && 
              w.raid_time_slot === record.raid_time_slot && 
              w.group_number === record.group_number
            )
          : undefined

        wsData.push([
          index + 1,
          record.player_id,
          record.school,
          record.is_commander ? '是' : '否',
          record.is_black_worker ? '是' : '否',
          record.raid_time_slot,
          record.team || '-',
          record.registration_type === '打本报名' ? record.group_number : '-',
          groupWarning?.warning || '',
          record.remark || '',
          new Date(record.created_at).toLocaleString('zh-CN')
        ])
      })
      
      const worksheet = XLSX.utils.aoa_to_sheet(wsData)

      // 设置列宽
      worksheet['!cols'] = [
        { wch: 6 },   // 序号
        { wch: 15 },  // 玩家ID
        { wch: 10 },  // 流派
        { wch: 10 },  // 是否指挥
        { wch: 10 },  // 是否黑工
        { wch: 12 },  // 时间
        { wch: 10 },  // 小队
        { wch: 6 },   // 组号
        { wch: 25 },  // 分组提醒
        { wch: 30 },  // 备注
        { wch: 20 }   // 报名时间
      ]

      // 设置表头样式
      headers.forEach((_, colIndex) => {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: colIndex })
        if (!worksheet[cellAddress]) worksheet[cellAddress] = {}
        worksheet[cellAddress].s = {
          fill: { fgColor: { rgb: 'FF4472C4' } },
          font: { bold: true, color: { rgb: 'FFFFFFFF' } },
          alignment: { horizontal: 'center', vertical: 'center' }
        }
      })

      // 为流派列（第3列，索引为2）设置颜色
      for (let rowIndex = 1; rowIndex < wsData.length; rowIndex++) {
        const school = wsData[rowIndex][2] as string
        const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: 2 })
        if (!worksheet[cellAddress]) worksheet[cellAddress] = {}
        worksheet[cellAddress].s = getSchoolStyle(school)
      }
      
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
      sheetIndex++
    }

    // 生成Buffer
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  }
}
