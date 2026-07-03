import { Page, Locator } from '@playwright/test';
import { TestCaseStep } from '../../types';
import { LocatorResolver } from '../LocatorResolver';
import { DataResolver } from '../DataResolver';
import { ExcelReader } from '../ExcelReader';

export interface ActionHandlerContext {
  page: Page;
  locatorResolver: LocatorResolver;
  dataResolver: DataResolver;
  excelReader: ExcelReader;
  pagesMap: Map<string, string>;
  contextData: Record<string, any>;
  tcId?: string;
  resolvedValue: string;
  resolvedExpected: string;
  locator: Locator | null;
  locatorString: string | null;
}

export interface ActionHandler {
  execute(
    step: TestCaseStep,
    context: ActionHandlerContext
  ): Promise<{
    status: 'PASSED' | 'FAILED' | 'TBD';
    observed: string;
    screenshotPath?: string;
  }>;
}
