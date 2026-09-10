/**
 * CampusOS AI Unified Test Runner
 * Runs all 7 test suites sequentially within a single process
 * to maintain warm connection pooling and prevent PgBouncer resets.
 */

import { db } from '../lib/db';
import { runWorkflowEngineTests } from '../tests/workflow-engine.test';
import { runAuthRbacTests } from '../tests/auth-rbac.test';
import { runAiIntakeTests } from '../tests/ai-intake.test';
import { runStaffTrackingE2eTests } from '../tests/staff-tracking-e2e.test';
import { runDocumentWorkflowE2eTests } from '../tests/document-workflow-e2e.test';
import { runApprovalNotificationE2eTests } from '../tests/approval-notification-e2e.test';
import { runProductionReadinessTests } from '../tests/production-readiness.test';

async function main() {
  console.log('🚀 Running Complete CampusOS AI Test Suite...\n');
  const startTime = Date.now();

  try {
    // 1. Workflow Engine Tests
    runWorkflowEngineTests();

    // 2. Auth & RBAC Security Tests
    runAuthRbacTests();

    // 3. AI Intake & Intent Classification Tests
    await runAiIntakeTests();

    // 4. Staff Operations & End-to-End Tracking Tests
    await runStaffTrackingE2eTests();

    // 5. Document Intelligence & Security Tests
    await runDocumentWorkflowE2eTests();

    // 6. Approval Intelligence & Notification Tests
    await runApprovalNotificationE2eTests();

    // 7. Phase 3 Production-Readiness Tests
    await runProductionReadinessTests();

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n🎉 ALL TEST SUITES COMPLETED SUCCESSFULLY in ${totalDuration}s!\n`);
  } catch (err) {
    console.error('\n❌ Test Suite Failed with error:', err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();

