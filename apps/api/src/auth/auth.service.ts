import { Injectable, ConflictException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { EncryptionService } from "../encryption/encryption.service";
import * as bcrypt from "bcryptjs";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private encryption: EncryptionService,
  ) {}

  async register(email: string, name: string, password: string) {
    const existing = await this.prisma.conteoUser.findUnique({ where: { email } });
    if (existing) throw new ConflictException("Email ya registrado");

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.prisma.conteoUser.create({
      data: { email, name, passwordHash },
      select: { id: true, email: true, name: true, role: true, actasAuditadas: true, createdAt: true },
    });

    const token = this.jwt.sign({ sub: user.id, email: user.email, role: user.role });
    return { user, token };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.conteoUser.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException("Credenciales incorrectas");

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Credenciales incorrectas");

    const token = this.jwt.sign({ sub: user.id, email: user.email, role: user.role });
    const { passwordHash: _, ...safeUser } = user;
    return { user: safeUser, token };
  }

  async findById(id: string) {
    const user = await this.prisma.conteoUser.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, actasAuditadas: true, createdAt: true, geminiKeyEncrypted: true },
    });
    if (!user) return null;
    const { geminiKeyEncrypted, ...safeUser } = user;
    return { ...safeUser, hasGeminiKey: !!geminiKeyEncrypted };
  }

  async saveGeminiKey(userId: string, key: string) {
    const { encrypted, iv } = this.encryption.encrypt(key);
    await this.prisma.conteoUser.update({
      where: { id: userId },
      data: { geminiKeyEncrypted: encrypted, geminiKeyIv: iv },
    });
    return { saved: true };
  }

  async deleteGeminiKey(userId: string) {
    await this.prisma.conteoUser.update({
      where: { id: userId },
      data: { geminiKeyEncrypted: null, geminiKeyIv: null },
    });
    return { deleted: true };
  }

  async communityStats() {
    const [totalAuditores, topAuditores, totalAuditadas] = await Promise.all([
      this.prisma.conteoUser.count(),
      this.prisma.conteoUser.findMany({
        orderBy: { actasAuditadas: "desc" },
        take: 10,
        select: { name: true, email: true, actasAuditadas: true },
      }),
      this.prisma.e14ActaIndex.count({ where: { auditedAt: { not: null } } }),
    ]);

    const totalActas = await this.prisma.e14ActaIndex.count();

    return {
      totalAuditores,
      totalAuditadas,
      totalActas,
      pctCompletado: parseFloat(((totalAuditadas / totalActas) * 100).toFixed(2)),
      topAuditores: topAuditores.map(u => ({
        name: u.name,
        email: u.email.split("@")[0] + "@...", // partial privacy
        actasAuditadas: u.actasAuditadas,
      })),
    };
  }
}
