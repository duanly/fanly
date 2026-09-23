import { Global, Module } from '@nestjs/common';
import { CpsService } from './cps.service';

@Global()
@Module({ providers: [CpsService], exports: [CpsService] })
export class CpsModule {}
