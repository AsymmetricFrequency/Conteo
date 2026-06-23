import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { passportJwtSecret } from "jwks-rsa";
import { PrismaService } from "../prisma/prisma.service";

const SUPABASE_JWKS = "https://abvnrcqkgebsrbzdpfwc.supabase.co/auth/v1/.well-known/jwks.json";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: SUPABASE_JWKS,
      }),
      algorithms: ["ES256"],
      ignoreExpiration: false,
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
    role: string;
    aud?: string;
    user_metadata?: { full_name?: string; name?: string };
  }) {
    // Supabase Google OAuth token
    const name =
      payload.user_metadata?.full_name ??
      payload.email?.split("@")[0] ??
      "Auditor";

    let user = await this.prisma.conteoUser.findUnique({
      where: { email: payload.email },
    });
    if (!user) {
      user = await this.prisma.conteoUser.create({
        data: { email: payload.email, name, passwordHash: "" },
      });
    }
    return { sub: user.id, email: user.email, role: user.role };
  }
}
