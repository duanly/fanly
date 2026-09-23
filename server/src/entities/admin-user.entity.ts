import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('admin_user')
export class AdminUser {
  @PrimaryGeneratedColumn() id: number;
  @Index({ unique: true }) @Column({ length: 32 }) username: string;
  @Column({ length: 100 }) password: string;
  /** super / ops / service / finance */
  @Column({ length: 16, default: 'ops' }) role: string;
  @Column({ type: 'tinyint', default: 1 }) status: number;
  @CreateDateColumn() createdAt: Date;
}
