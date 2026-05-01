import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { env } from './env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: env.WEB_ORIGIN ?? true,
  });
  await app.listen(env.PORT ?? 3000);
}
void bootstrap();
