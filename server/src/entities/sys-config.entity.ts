import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** 后台可调参数（分佣比例等），改完即时生效 */
@Entity('sys_config')
export class SysConfig {
  @PrimaryColumn({ length: 64 }) key: string;
  @Column({ length: 1024 }) value: string;
  @Column({ length: 255, default: '' }) remark: string;
  @UpdateDateColumn() updatedAt: Date;
}
