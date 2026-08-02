import type { Express, Request, RequestHandler } from "express";
import type { ReportMetadata, SessionReport, TeacherUser } from "@quizstrike/shared";

type AuthenticatedRequest = Request & { user?: TeacherUser };
type StoredReport = ReportMetadata & { report: SessionReport };

type NormalizedLibrary = {
  getReport(teacherId: string, reportId: string): Promise<{ metadata: ReportMetadata; report: SessionReport } | undefined>;
  deleteReport(teacherId: string, reportId: string): Promise<boolean>;
};

export type ReportRouteDependencies = {
  requireTeacher: RequestHandler;
  normalizedLibrary?: NormalizedLibrary;
  reports: Map<string, StoredReport>;
  durableReportMetadataForTeacher: (teacherId: string) => Promise<unknown>;
  reportMetadataForTeacher: (teacherId: string) => ReportMetadata[];
  routeParam: (value: string | string[] | undefined) => string;
  schedulePersistence: () => void;
};

export const registerReportRoutes = (app: Express, dependencies: ReportRouteDependencies) => {
  const {
    requireTeacher,
    normalizedLibrary,
    reports,
    durableReportMetadataForTeacher,
    reportMetadataForTeacher,
    routeParam,
    schedulePersistence
  } = dependencies;

  app.get("/api/reports", requireTeacher, async (req: AuthenticatedRequest, res) => {
    res.json({ reports: await durableReportMetadataForTeacher(req.user!.id) });
  });

  app.get("/api/reports/:id", requireTeacher, async (req: AuthenticatedRequest, res) => {
    const reportId = routeParam(req.params.id);
    const durable = await normalizedLibrary?.getReport(req.user!.id, reportId);
    const report = durable ?? reports.get(reportId);
    const reportTeacherId = durable?.metadata.teacherId ?? (report as StoredReport | undefined)?.teacherId;
    if (!report || reportTeacherId !== req.user!.id) {
      res.status(404).json({ error: "Report not found." });
      return;
    }
    res.json({ report: report.report, metadata: durable?.metadata ?? reportMetadataForTeacher(req.user!.id).find((item) => item.id === reportId) });
  });

  app.delete("/api/reports/:id", requireTeacher, async (req: AuthenticatedRequest, res) => {
    const reportId = routeParam(req.params.id);
    const deletedDurable = normalizedLibrary ? await normalizedLibrary.deleteReport(req.user!.id, reportId) : false;
    const report = reports.get(reportId);
    if (!deletedDurable && (!report || report.teacherId !== req.user!.id)) {
      res.status(404).json({ error: "Report not found or already deleted." });
      return;
    }
    reports.delete(reportId);
    schedulePersistence();
    res.json({ deletedReportId: reportId });
  });
};
