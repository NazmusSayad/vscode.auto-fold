import * as vscode from 'vscode'

export function getStringSearchImports(
  document: vscode.TextDocument
): number[] {
  try {
    const lines = document.getText().split('\n')
    const importStart = lines.findIndex((line) =>
      line.trim().startsWith('import')
    )

    return [importStart].filter((line) => line !== -1)
  } catch (err) {
    console.error('Error getting string search imports:', err)
    return []
  }
}

export async function getFoldingRangeImports(
  uri: vscode.Uri,
  initDocument?: vscode.TextDocument
) {
  try {
    const foldingRanges = await vscode.commands.executeCommand<
      vscode.FoldingRange[]
    >('vscode.executeFoldingRangeProvider', uri)

    const document =
      initDocument ?? (await vscode.workspace.openTextDocument(uri))

    if (!foldingRanges) {
      throw new Error('No folding ranges found')
    }

    const filteredRanges = foldingRanges.filter((range) => {
      if (range.kind !== vscode.FoldingRangeKind.Imports) return false

      const content = document.getText(
        new vscode.Range(
          new vscode.Position(range.start, 0),
          new vscode.Position(range.start + 1, 0)
        )
      )

      /**
       * Check if the line starts with 'import', works only for JS and TS
       */
      const trimmedContent = content.trim()
      if (!trimmedContent.startsWith('import')) return false

      console.log('import found:', trimmedContent)
      return true
    })

    return filteredRanges[0] ? [filteredRanges[0]] : []
  } catch (err) {
    console.error('Error getting folding ranges:', err)
    return []
  }
}

export async function foldSelection(
  start: number,
  editor: vscode.TextEditor | null
) {
  try {
    console.warn('Folding selection at line:', start)
    if (isAlreadyFolded(start, editor)) {
      return console.log('Line already folded, skipping')
    }

    await vscode.commands.executeCommand('editor.fold', {
      selectionLines: [start],
      direction: 'up',
      levels: 1,
    })
  } catch (err) {
    console.error('Error folding selection:', err)
  }
}

export async function unfoldSelection(start: number) {
  try {
    console.warn('Unfolding selection at line:', start)
    await vscode.commands.executeCommand('editor.unfold', {
      selectionLines: [start],
    })
  } catch (err) {
    console.error('Error unfolding selection:', err)
  }
}

export function isAlreadyFolded(
  start: number,
  editor: vscode.TextEditor | null
): boolean {
  if (!editor) return false
  const doc = editor.document

  if (start < 0 || start + 1 >= doc.lineCount) return false

  const nextLine = start + 1
  for (const range of editor.visibleRanges) {
    if (range.start.line <= nextLine && nextLine <= range.end.line) {
      return false
    }
  }

  return true
}

export function getTextEditorByDocument(
  document: vscode.TextDocument
): vscode.TextEditor | null {
  return (
    vscode.window.visibleTextEditors.find(
      (editor) => editor.document.uri.toString() === document.uri.toString()
    ) ?? null
  )
}
