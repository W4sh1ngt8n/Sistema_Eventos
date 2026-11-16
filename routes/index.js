const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const asyncHandler = require('../utils/asyncHandler');

const AuthController = require('../controllers/AuthController');
const UserController = require('../controllers/UserController');
const EventController = require('../controllers/EventController');
const RegistrationController = require('../controllers/RegistrationController');
const AttendanceController = require('../controllers/AttendanceController');
const WorkController = require('../controllers/WorkController');
const EvaluationController = require('../controllers/EvaluationController');
const ReportController = require('../controllers/ReportController');

const { generateQrCodeDataUrl } = require('../utils/qrToken');

// ===== Rate limiting =====
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' }
});

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente mais tarde.' }
});

// ===== AUTH =====
router.get('/auth/has-admin', asyncHandler(AuthController.hasAdmin));
router.post('/auth/setup', loginLimiter, asyncHandler(AuthController.setup));
router.post('/auth/login', loginLimiter, asyncHandler(AuthController.login));
router.get('/auth/me', authMiddleware, asyncHandler(AuthController.me));
router.put('/auth/password', authMiddleware, asyncHandler(AuthController.changePassword));
router.put('/auth/force-change-password', authMiddleware, asyncHandler(AuthController.forceChangePassword));

// ===== USERS =====
router.get('/users', authMiddleware, roleMiddleware('DIRECAO', 'ADMIN'), asyncHandler(UserController.list));
router.post('/users', authMiddleware, roleMiddleware('DIRECAO', 'ADMIN'), asyncHandler(UserController.create));
router.put('/users/:id', authMiddleware, roleMiddleware('DIRECAO', 'ADMIN'), asyncHandler(UserController.update));
router.delete('/users/:id', authMiddleware, roleMiddleware('ADMIN'), asyncHandler(UserController.delete));
router.put('/users/:id/reset-password', authMiddleware, roleMiddleware('DIRECAO', 'ADMIN'), asyncHandler(UserController.resetPassword));

// ===== EVENTS =====
router.get('/events/active', asyncHandler(EventController.listActive));
router.get('/events', authMiddleware, asyncHandler(EventController.list));
router.get('/events/:id', authMiddleware, asyncHandler(EventController.findById));
router.post('/events', authMiddleware, roleMiddleware('DIRECAO', 'ADMIN', 'ORGANIZACAO'), asyncHandler(EventController.create));
router.put('/events/:id', authMiddleware, roleMiddleware('DIRECAO', 'ADMIN', 'ORGANIZACAO'), asyncHandler(EventController.update));
router.delete('/events/:id', authMiddleware, roleMiddleware('ADMIN'), asyncHandler(EventController.delete));
router.get('/events/:id/metrics', authMiddleware, asyncHandler(EventController.getMetrics));

// ===== REGISTRATIONS =====
router.post('/registrations', publicLimiter, asyncHandler(RegistrationController.create));
router.get('/registrations/cpf/:cpf', publicLimiter, asyncHandler(RegistrationController.findByCpf));
router.get('/registrations/event/:evento_id', authMiddleware, roleMiddleware('MONITOR', 'ORGANIZACAO', 'DIRECAO', 'ADMIN'), asyncHandler(RegistrationController.findByEvent));
router.put('/registrations/:id/validate-payment', authMiddleware, roleMiddleware('MONITOR', 'ORGANIZACAO', 'DIRECAO', 'ADMIN'), asyncHandler(RegistrationController.validatePayment));
router.put('/registrations/:id/invalidate-payment', authMiddleware, roleMiddleware('ORGANIZACAO', 'DIRECAO', 'ADMIN'), asyncHandler(RegistrationController.invalidatePayment));

// Recuperar inscrição existente (público — exige CPF + evento + email conferirem)
router.post('/registrations/recover', publicLimiter, asyncHandler(RegistrationController.recover));

// ===== PIX QR CODE (público) =====
router.post('/registrations/pix-qr', publicLimiter, asyncHandler(async (req, res) => {
  const { pix_key } = req.body;
  if (!pix_key) {
    return res.status(400).json({ error: 'Chave Pix é obrigatória.' });
  }
  try {
    const qrCodeUrl = await generateQrCodeDataUrl(pix_key);
    return res.json({ qr_code_url: qrCodeUrl, pix_key });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao gerar QR Code.' });
  }
}));

// ===== ATTENDANCE =====
router.post('/attendance/qr', authMiddleware, roleMiddleware('MONITOR', 'ORGANIZACAO', 'ADMIN', 'DIRECAO'), asyncHandler(AttendanceController.registerByQr));
router.post('/attendance/cpf', authMiddleware, roleMiddleware('MONITOR', 'ORGANIZACAO', 'ADMIN', 'DIRECAO'), asyncHandler(AttendanceController.registerByCpf));
router.get('/attendance/event/:evento_id', authMiddleware, roleMiddleware('MONITOR', 'ORGANIZACAO', 'DIRECAO', 'ADMIN'), asyncHandler(AttendanceController.findByEvent));

// ===== WORKS =====
router.post('/works', publicLimiter, asyncHandler(WorkController.submit));
router.get('/works/event/:evento_id', authMiddleware, roleMiddleware('ORGANIZACAO', 'DIRECAO', 'ADMIN'), asyncHandler(WorkController.findByEvent));
router.get('/works/my-evaluations', authMiddleware, roleMiddleware('AVALIADOR', 'ADMIN'), asyncHandler(WorkController.findByEvaluator));
router.post('/works/:id/assign', authMiddleware, roleMiddleware('ORGANIZACAO', 'DIRECAO', 'ADMIN'), asyncHandler(WorkController.assignEvaluator));
router.get('/works/:id/evaluators', authMiddleware, roleMiddleware('ORGANIZACAO', 'DIRECAO', 'ADMIN'), asyncHandler(WorkController.getEvaluators));

// ===== EVALUATIONS =====
router.post('/evaluations', authMiddleware, roleMiddleware('AVALIADOR', 'ADMIN'), asyncHandler(EvaluationController.create));
router.get('/evaluations/work/:trabalho_id', authMiddleware, roleMiddleware('AVALIADOR', 'ORGANIZACAO', 'DIRECAO', 'ADMIN'), asyncHandler(EvaluationController.findByWork));

// ===== REPORTS =====
router.post('/reports/certificate', authMiddleware, roleMiddleware('DIRECAO', 'ADMIN', 'ORGANIZACAO'), asyncHandler(ReportController.generateCertificate));
router.post('/reports/certificates/batch', authMiddleware, roleMiddleware('DIRECAO', 'ADMIN', 'ORGANIZACAO'), asyncHandler(ReportController.generateBatchCertificates));
router.get('/reports/event/:evento_id', authMiddleware, roleMiddleware('DIRECAO', 'ADMIN', 'ORGANIZACAO'), asyncHandler(ReportController.generateEventReport));
router.post('/reports/semester', authMiddleware, roleMiddleware('DIRECAO', 'ADMIN'), asyncHandler(ReportController.generateSemesterReport));

module.exports = router;