import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HomeLink } from '@/entities';

@Injectable()
export class HomeLinkService {
  constructor(
    @InjectRepository(HomeLink) private readonly repo: Repository<HomeLink>,
  ) {}

  /** 前台只要上架的；传了 slot 就只给那一块 */
  publicList(slot?: string) {
    const where: any = { status: 1 };
    if (slot) where.slot = slot;
    return this.repo.find({ where, order: { sortWeight: 'DESC', id: 'ASC' } });
  }

  adminList(slot?: string) {
    const where: any = {};
    if (slot) where.slot = slot;
    return this.repo.find({ where, order: { sortWeight: 'DESC', id: 'ASC' } });
  }

  async save(body: Partial<HomeLink> & { id?: number }) {
    const row = body.id
      ? await this.repo.findOneBy({ id: body.id })
      : this.repo.create();
    if (!row) throw new NotFoundException('活动位不存在');
    Object.assign(row, {
      slot: body.slot ?? row.slot ?? 'entry',
      image: body.image ?? row.image,
      title: body.title ?? row.title,
      subtitle: body.subtitle ?? row.subtitle,
      icon: body.icon ?? row.icon,
      url: body.url ?? row.url,
      internal: body.internal ?? row.internal,
      sortWeight: body.sortWeight ?? row.sortWeight,
      status: body.status ?? row.status,
    });
    return this.repo.save(row);
  }

  async remove(id: number) {
    const r = await this.repo.delete({ id });
    return { deleted: r.affected ?? 0 };
  }
}
