import { pgTable, serial, timestamp, varchar, integer, boolean, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"


export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 游戏公会打本报名记录表
export const raidRegistrations = pgTable(
	"raid_registrations",
	{
		id: serial().primaryKey(),
		registration_type: varchar("registration_type", { length: 20 }).default("打本报名").notNull(), // 报名类型：打本报名、其他活动报名、百业战报名
		player_id: varchar("player_id", { length: 50 }).notNull(),
		school: varchar("school", { length: 20 }).notNull(),
		is_commander: boolean("is_commander").default(false).notNull(), // 是否为指挥
		raid_date: varchar("raid_date", { length: 20 }).notNull(), // 格式: YYYY-MM-DD 或 周六/周日/周六及周日
		raid_time_slot: varchar("raid_time_slot", { length: 20 }).notNull(), // 时段
		team: varchar("team", { length: 20 }), // 小队：进攻组、防守组（百业战报名专用）
		remark: varchar("remark", { length: 200 }), // 备注
		group_number: integer("group_number").default(0), // 0表示未分组
		created_at: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	},
	(table) => [
		index("raid_registrations_registration_type_idx").on(table.registration_type),
		index("raid_registrations_raid_date_idx").on(table.raid_date),
		index("raid_registrations_raid_time_slot_idx").on(table.raid_time_slot),
		index("raid_registrations_group_number_idx").on(table.group_number),
		index("raid_registrations_team_idx").on(table.team),
	]
);

export type RaidRegistration = typeof raidRegistrations.$inferSelect;
