import type { APIRequestContext } from "@playwright/test";

export const createClassroom = async (
  request: APIRequestContext,
  { gameMode = "classic" }: { gameMode?: "classic" | "flag" } = {}
) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const signup = await request.post("/api/auth/signup", {
    data: {
      name: "Mobile Test Teacher",
      email: `mobile-${suffix}@example.test`,
      password: "classroom-pass"
    }
  });
  if (signup.status() !== 201) throw new Error(`Teacher signup failed with ${signup.status()}.`);
  const { token } = await signup.json() as { token: string };
  const authorization = { Authorization: `Bearer ${token}` };

  const quiz = await request.post("/api/quiz-sets", {
    headers: authorization,
    data: { title: `Mobile Quiz ${suffix}` }
  });
  if (quiz.status() !== 201) throw new Error(`Quiz creation failed with ${quiz.status()}.`);
  const { quizSet } = await quiz.json() as { quizSet: { id: string } };
  const question = await request.post(`/api/quiz-sets/${quizSet.id}/questions`, {
    headers: authorization,
    data: {
      prompt: "Which answer is correct?",
      choiceA: "This one",
      choiceB: "Not this one",
      choiceC: "Still no",
      choiceD: "Nope",
      correctChoice: "A"
    }
  });
  if (question.status() !== 201) throw new Error(`Question creation failed with ${question.status()}.`);

  const created = await request.post("/api/sessions", {
    headers: authorization,
    data: {
      quizSetId: quizSet.id,
      settings: { gameMode, maxPlayers: 2, roundDurationSeconds: 60 }
    }
  });
  if (created.status() !== 201) throw new Error(`Session creation failed with ${created.status()}.`);
  const { session } = await created.json() as { session: { sessionCode: string } };
  return { code: session.sessionCode, teacherToken: token };
};
