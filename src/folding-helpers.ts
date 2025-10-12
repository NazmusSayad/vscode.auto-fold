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

export function foldSelectionRange(
  range: vscode.FoldingRange,
  editor: vscode.TextEditor
) {
  if (isStartInsideFoldingRange(range.start, editor)) {
    return console.log('Start is inside a folded range, skipping fold')
  }

  if (isEndOutsideVisibleRange(range.end, editor)) {
    return console.log('End is before visible range, skipping fold')
  }

  return foldSelectionStart(range.start)
}

export function unfoldSelectionRange(
  range: vscode.FoldingRange,
  editor: vscode.TextEditor
) {
  if (!isStartInsideFoldingRange(range.start, editor)) {
    return console.log('Start is not inside a folded range, skipping unfold')
  }

  if (isEndOutsideVisibleRange(range.end, editor)) {
    return console.log('End is before visible range, skipping unfold')
  }

  return unfoldSelectionStart(range.start + 1)
}

export async function foldSelectionStart(start: number) {
  try {
    console.warn('Folding selection at line:', start)

    await vscode.commands.executeCommand('editor.fold', {
      selectionLines: [start],
      levels: 1,
    })
  } catch (err) {
    console.error('Error folding selection:', err)
  }
}

export async function unfoldSelectionStart(start: number) {
  try {
    console.warn('Unfolding selection at line:', start)

    await vscode.commands.executeCommand('editor.unfold', {
      selectionLines: [start],
    })
  } catch (err) {
    console.error('Error unfolding selection:', err)
  }
}

function isEndOutsideVisibleRange(end: number, editor: vscode.TextEditor) {
  const visibleStart = editor.visibleRanges[0].start.line
  return visibleStart > end
}

function isStartInsideFoldingRange(
  start: number,
  editor: vscode.TextEditor
): boolean {
  const foldedAreas: { start: number; end: number }[] = []
  const visibleRanges = editor.visibleRanges
  if (visibleRanges.length === 0) {
    console.log('No visible ranges, assuming everything is folded')
    return false
  }

  let prevEnd: number | null = null

  console.log('Visible ranges:', visibleRanges)
  for (const range of visibleRanges) {
    if (prevEnd !== null && range.start.line > prevEnd) {
      foldedAreas.push({ start: prevEnd, end: range.start.line })
    }

    prevEnd = range.end.line
  }

  if (foldedAreas.length === 0) {
    console.log('No folded areas detected')
    return false
  }

  console.log('Folded areas:', foldedAreas)
  for (const area of foldedAreas) {
    if (start >= area.start && start <= area.end) {
      console.log('Start is inside a folded area:', area)
      return true
    }
  }

  return false
}
