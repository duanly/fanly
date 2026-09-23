import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';

@Catch()
export class AllExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(ex: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const isHttp = ex instanceof HttpException;
    const status = isHttp ? ex.getStatus() : 500;
    const body: any = isHttp ? ex.getResponse() : null;
    const msg = typeof body === 'string' ? body : body?.message || (ex as Error)?.message || '服务器错误';
    if (!isHttp) this.logger.error((ex as Error)?.stack || String(ex));
    res.status(status).json({
      code: status,
      msg: Array.isArray(msg) ? msg.join('; ') : msg,
      data: null,
    });
  }
}
