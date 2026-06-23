import { Controller, Post, Delete, Get, Body, UseGuards, Request } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Post("register")
  register(@Body() body: { email: string; name: string; password: string }) {
    return this.service.register(body.email, body.name, body.password);
  }

  @Post("login")
  login(@Body() body: { email: string; password: string }) {
    return this.service.login(body.email, body.password);
  }

  @Get("me")
  @UseGuards(AuthGuard("jwt"))
  me(@Request() req: { user: { sub: string } }) {
    return this.service.findById(req.user.sub);
  }

  @Get("community-stats")
  communityStats() {
    return this.service.communityStats();
  }

  @Get("auditors")
  auditorList() {
    return this.service.auditorList();
  }

  @Post("gemini-key")
  @UseGuards(AuthGuard("jwt"))
  saveGeminiKey(
    @Request() req: { user: { sub: string } },
    @Body() body: { key: string },
  ) {
    return this.service.saveGeminiKey(req.user.sub, body.key);
  }

  @Delete("gemini-key")
  @UseGuards(AuthGuard("jwt"))
  deleteGeminiKey(@Request() req: { user: { sub: string } }) {
    return this.service.deleteGeminiKey(req.user.sub);
  }

  @Post("anthropic-key")
  @UseGuards(AuthGuard("jwt"))
  saveAnthropicKey(
    @Request() req: { user: { sub: string } },
    @Body() body: { key: string },
  ) {
    return this.service.saveAnthropicKey(req.user.sub, body.key);
  }

  @Delete("anthropic-key")
  @UseGuards(AuthGuard("jwt"))
  deleteAnthropicKey(@Request() req: { user: { sub: string } }) {
    return this.service.deleteAnthropicKey(req.user.sub);
  }
}
