import bcrypt from "bcryptjs";
import type { Express, NextFunction, Request, Response } from "express";
import type { TeacherUser } from "@quizstrike/shared";

type StoredUser = TeacherUser & { passwordHash: string };
type AuthenticatedRequest = Request & { user?: TeacherUser };

export const registerAuthRoutes = (
  app: Express,
  {
    users,
    normalizedLibrary,
    cleanEmail,
    publicUser,
    makeToken,
    makeId,
    schedulePersistence,
    requireTeacher,
    healthPayload
  }: {
    users: Map<string, StoredUser>;
    normalizedLibrary?: { saveUser(user: StoredUser): Promise<unknown> };
    cleanEmail: (email: string) => string;
    publicUser: (user: StoredUser) => TeacherUser;
    makeToken: (user: TeacherUser) => string;
    makeId: () => string;
    schedulePersistence: () => void;
    requireTeacher: (req: Request, res: Response, next: NextFunction) => void;
    healthPayload: () => Record<string, unknown>;
  }
) => {
  app.get(["/health", "/api/health"], (_req, res) => {
    res.json(healthPayload());
  });

  app.post("/api/auth/signup", async (req, res) => {
    const name = String(req.body.name ?? "").trim();
    const email = cleanEmail(String(req.body.email ?? ""));
    const password = String(req.body.password ?? "");

    if (name.length < 2 || !email.includes("@") || password.length < 8) {
      res.status(400).json({ error: "Enter a name, valid email, and password of at least 8 characters." });
      return;
    }

    if ([...users.values()].some((user) => user.email === email)) {
      res.status(409).json({ error: "A teacher with that email already exists." });
      return;
    }

    const user: StoredUser = {
      id: makeId(),
      name,
      email,
      role: "teacher",
      passwordHash: await bcrypt.hash(password, 10)
    };
    if (normalizedLibrary) await normalizedLibrary.saveUser(user);
    users.set(user.id, user);
    schedulePersistence();
    const teacher = publicUser(user);
    res.status(201).json({ user: teacher, token: makeToken(teacher) });
  });

  app.post("/api/auth/login", async (req, res) => {
    const email = cleanEmail(String(req.body.email ?? ""));
    const password = String(req.body.password ?? "");
    const user = [...users.values()].find((candidate) => candidate.email === email);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: "Email or password was not recognized." });
      return;
    }

    const teacher = publicUser(user);
    res.json({ user: teacher, token: makeToken(teacher) });
  });

  app.get("/api/me", requireTeacher, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.user });
  });
};
