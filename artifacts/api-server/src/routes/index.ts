import { Router, type IRouter } from "express";
import healthRouter from "./health";
import runbooksRouter from "./runbooks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(runbooksRouter);

export default router;
