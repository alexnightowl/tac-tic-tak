import { ArgumentsHost, Catch, NotFoundException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';

/**
 * Global filter for Prisma's known request errors (B2).
 *
 * P2025 ("record to update/delete not found", also thrown by
 * find*OrThrow) becomes the standard Nest 404 body
 * `{statusCode: 404, message: 'not found', error: 'Not Found'}`
 * instead of an unhandled 500 (e.g. POST /review/:id/resolve for an item
 * that is not in the queue). Every other Prisma error is handed to Nest's
 * default handler unchanged, so it is still logged and still a 500.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    if (exception.code === 'P2025') {
      return super.catch(new NotFoundException('not found'), host);
    }
    return super.catch(exception, host);
  }
}
