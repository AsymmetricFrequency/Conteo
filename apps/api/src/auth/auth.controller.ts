import { Controller, Post, Get, Body, UseGuards, Request } from "@nestjs/common";
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
}
