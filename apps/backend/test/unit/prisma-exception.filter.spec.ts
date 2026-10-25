import type { ArgumentsHost } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from '../../src/common/prisma-exception.filter';

function known(code: string) {
  return new Prisma.PrismaClientKnownRequestError('boom', { code, clientVersion: 'test' });
}

describe('PrismaExceptionFilter (B2)', () => {
  const reply = jest.fn();
  const adapter: any = { reply, isHeadersSent: () => false, end: jest.fn() };
  const filter = new PrismaExceptionFilter(adapter);
  const res = {};
  const host = {
    getArgByIndex: (i: number) => (i === 1 ? res : {}),
    getArgs: () => [{}, res],
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({}) }),
    getType: () => 'http',
  } as unknown as ArgumentsHost;

  beforeEach(() => {
    reply.mockClear();
    jest.spyOn(Logger, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('P2025 → standard Nest 404 body', () => {
    filter.catch(known('P2025'), host);
    expect(reply).toHaveBeenCalledWith(res, { statusCode: 404, message: 'not found', error: 'Not Found' }, 404);
  });

  it.each(['P2002', 'P2003', 'P2034'])('%s keeps the default 500', (code) => {
    filter.catch(known(code), host);
    expect(reply).toHaveBeenCalledWith(res, { statusCode: 500, message: 'Internal server error' }, 500);
  });
});
