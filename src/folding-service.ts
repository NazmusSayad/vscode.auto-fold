import * as vscode from 'vscode'
import ConfigService from './config-service'
import {
  foldSelectionRange,
  foldSelectionStart,
  getFoldingRangeImports,
  getStringSearchImports,
  unfoldSelectionRange,
  unfoldSelectionStart,
} from './folding-helpers'

export default class FoldingService extends ConfigService {
  private ctx: vscode.ExtensionContext

  constructor(ctx: vscode.ExtensionContext) {
    super()
    this.ctx = ctx
    console.log('--> FoldingService initialized')
  }

  private documentOpenCloseMap = new Set<string>()

  private canDocumentBeSkipped = (document: vscode.TextDocument): boolean => {
    if (document.isDirty) return true
    if (document.isClosed) return true
    if (document.isUntitled) return true
    if (document.uri.scheme !== 'file') return true

    return false
  }

  public onDocumentOpen = async (document: vscode.TextDocument) => {
    if (!this.config.enableAutoFoldImportsOnOpen) return

    if (!document) return console.warn('No document found')
    if (this.canDocumentBeSkipped(document)) {
      return console.warn('Document skipped', document.uri.toString())
    }

    const isOpen = this.documentOpenCloseMap.has(document.uri.toString())
    if (isOpen) return console.warn('Document already opened, skipping folding')

    this.documentOpenCloseMap.add(document.uri.toString())
    console.log('> `onDocumentOpen`', document.uri.toString())

    /*
     * This is manual way to find the first import statement, and fold that
     * We are using this method to fold the first import statement.
     * It's in use because sometime vscode does not fold the import statements
     */
    if (
      this.config.enableStrSearchImportsForJS &&
      (document.languageId.startsWith('javascript') ||
        document.languageId.startsWith('typescript'))
    ) {
      const strSearchImports = getStringSearchImports(document)
      for (const start of strSearchImports) {
        await foldSelectionStart(start)
      }

      console.log(
        '> `onDocumentOpen`',
        'String search imports',
        strSearchImports.length
      )
    }

    /*
     * This is the correct way to fold all import statements
     * But it is not working as expected
     * So we are using the above method to fold the first import statement
     */
    const foldingRanges = await getFoldingRangeImports(document.uri, document)
    for (const range of foldingRanges) {
      await foldSelectionStart(range.start)
    }

    console.log(
      '> `onDocumentOpen`',
      'Folding range imports',
      foldingRanges.length
    )
  }

  public onDocumentClose = async (document: vscode.TextDocument) => {
    if (!document) return console.warn('No document found')

    if (this.canDocumentBeSkipped(document)) {
      return console.warn('Document skipped', document.uri.toString())
    }

    this.documentOpenCloseMap.delete(document.uri.toString())
    console.log(
      '> `onDocumentClose`',
      document.uri.toString(),
      document.isClosed
    )
  }

  public onSelectionChange = async (
    event: vscode.TextEditorSelectionChangeEvent
  ) => {
    if (!this.config.autoFoldOnSelectionChange) return

    if (event.textEditor !== vscode.window.activeTextEditor) return

    const document = event.textEditor.document
    const selection = event.textEditor.selection
    if (!document || !selection) {
      return console.warn('No document or selection found')
    }

    for (const range of await getFoldingRangeImports(document.uri, document)) {
      console.log('---> Folding range', range)

      const rangeStart = Math.max(
        range.start - this.config.selectionLineOffsetPadding,
        0
      )

      const rangeEnd = Math.min(
        range.end + this.config.selectionLineOffsetPadding,
        document.lineCount - 1
      )

      const isStartInRange =
        rangeStart <= selection.start.line && rangeEnd >= selection.start.line

      const isEndInRange =
        rangeStart <= selection.end.line && rangeEnd >= selection.end.line

      if (isStartInRange || isEndInRange) {
        await unfoldSelectionRange(range, event.textEditor)
      } else {
        await foldSelectionRange(range, event.textEditor)
      }
    }
  }
}
