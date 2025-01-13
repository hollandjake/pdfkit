/**
 * Render a cell
 *
 * @this PDFTable
 * @memberOf PDFTable
 * @param {SizedNormalizedTableCellStyle[]} row
 * @param {number} rowIndex
 * @private
 */
export function renderRow(row, rowIndex) {
  const rowStruct = this.document.struct('TR');
  row.forEach((cell) => renderCell.call(this, cell, rowStruct));
  this._struct.add(rowStruct);

  return this._rowYPos[rowIndex] + this._rowHeights[rowIndex];
}

/**
 * Render a cell
 *
 * @this PDFTable
 * @memberOf PDFTable
 * @param {SizedNormalizedTableCellStyle} cell
 * @param {PDFStructureElement} rowStruct
 * @private
 */
function renderCell(cell, rowStruct) {
  const s = this.document.struct(cell.type);
  rowStruct.add(s);
  s.dictionary.data.Width = cell.width;
  s.dictionary.data.Height = cell.height;
  s.dictionary.data.Padding = [
    cell.padding.top,
    cell.padding.bottom,
    cell.padding.left,
    cell.padding.right,
  ];
  s.dictionary.data.RowSpan = cell.rowSpan;
  s.dictionary.data.ColSpan = cell.colSpan;
  s.add(() => {
    // Render cell background
    if (cell.backgroundColor !== undefined) {
      s.dictionary.data.BackgroundColor =
        this.document._normalizeColor(cell.backgroundColor) ?? undefined;
      this.document
        .save()
        .rect(cell.x, cell.y, cell.width, cell.height)
        .fill(cell.backgroundColor)
        .restore();
    }

    // Render border
    s.dictionary.data.BorderColor =
      this.document._normalizeColor(cell.borderColor) ?? undefined;
    s.dictionary.data.BorderThickness = [
      cell.border.top,
      cell.border.bottom,
      cell.border.left,
      cell.border.right,
    ];
    renderBorder.call(
      this,
      cell.border,
      cell.borderColor,
      cell.x,
      cell.y,
      cell.width,
      cell.height,
    );

    // Debug cell borders
    if (cell.debug) {
      this.document.save();
      this.document.dash(1, { space: 1 }).lineWidth(1).strokeOpacity(0.3);

      // Debug cell bounds
      this.document
        .rect(cell.x, cell.y, cell.width, cell.height)
        .stroke('green');

      this.document.restore();
    }

    // Render content
    if (cell.content) renderCellContent.call(this, cell);
  });
}

/**
 * @this PDFTable
 * @memberOf PDFTable
 * @param cell
 */
function renderCellContent(cell) {
  // Configure fonts
  const rollbackFont = this.document._fontSource;
  const rollbackFontSize = this.document._fontSize;
  const rollbackFontFamily = this.document._fontFamily;
  if (cell.font?.src) this.document.font(cell.font.src, cell.font?.family);
  if (cell.font?.size) this.document.fontSize(cell.font.size);

  const x = cell.contentX;
  const y = cell.contentY;
  const Ah = cell.contentAllocatedHeight;
  const Aw = cell.contentAllocatedWidth;
  const Cw = cell.contentBounds.width;
  const Ch = cell.contentBounds.height;
  const Ox = -cell.contentBounds.x;
  const Oy = -cell.contentBounds.y;

  const PxScale =
    cell.align.x === 'right' ? 1 : cell.align.x === 'center' ? 0.5 : 0;
  const Px = (Aw - Cw) * PxScale;
  const PyScale =
    cell.align.y === 'bottom' ? 1 : cell.align.y === 'center' ? 0.5 : 0;
  const Py = (Ah - Ch) * PyScale;

  const dx = Px + Ox;
  const dy = Py + Oy;

  if (cell.debug) {
    this.document.save();
    this.document.dash(1, { space: 1 }).lineWidth(1).strokeOpacity(0.3);

    // Debug actual contents bounds
    if (cell.content) {
      this.document
        .moveTo(x + Px, y)
        .lineTo(x + Px, y + Ah)
        .moveTo(x + Px + Cw, y)
        .lineTo(x + Px + Cw, y + Ah)
        .stroke('blue')
        .moveTo(x, y + Py)
        .lineTo(x + Aw, y + Py)
        .moveTo(x, y + Py + Ch)
        .lineTo(x + Aw, y + Py + Ch)
        .stroke('green');
    }
    // Debug allocated content bounds
    this.document.rect(x, y, Aw, Ah).stroke('orange');

    this.document.restore();
  }

  // Create content mask to cut off any overflowing text
  // Mask cuts off at the padding not the actual cell, this is intentional!
  this.document.save().rect(x, y, Aw, Ah).clip();

  this.document.fillColor(cell.textColor).strokeColor(cell.textStrokeColor);
  if (cell.textStroke > 0) this.document.lineWidth(cell.textStroke);

  // Render the text
  this.document.text(cell.content, x + dx, y + dy, cell.textOptions);

  // Cleanup
  this.document.restore();
  this.document.font(rollbackFont, rollbackFontFamily, rollbackFontSize);
}

/**
 * @this PDFTable
 * @memberOf PDFTable
 * @param {ExpandedSideDefinition<number>} border
 * @param {ExpandedSideDefinition<PDFColor>} borderColor
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {number[]} [mask]
 * @private
 */
function renderBorder(border, borderColor, x, y, width, height, mask) {
  const computedBorder = Object.fromEntries(
    Object.entries(border).map(([k, v]) => [k, mask && !mask[k] ? 0 : v]),
  );

  if (
    [computedBorder.right, computedBorder.bottom, computedBorder.left].every(
      (val) => val === computedBorder.top,
    )
  ) {
    if (computedBorder.top > 0) {
      this.document
        .save()
        .lineWidth(computedBorder.top)
        .rect(x, y, width, height)
        .stroke(borderColor.top)
        .restore();
    }
  } else {
    // Top
    if (computedBorder.top > 0) {
      this.document
        .save()
        .lineWidth(computedBorder.top)
        .polygon([x, y], [x + width, y])
        .stroke(borderColor.top)
        .restore();
    }
    // Right
    if (computedBorder.right > 0) {
      this.document
        .save()
        .lineWidth(computedBorder.right)
        .polygon([x + width, y], [x + width, y + height])
        .stroke(borderColor.right)
        .restore();
    }
    // Bottom
    if (computedBorder.bottom > 0) {
      this.document
        .save()
        .lineWidth(computedBorder.bottom)
        .polygon([x + width, y + height], [x, y + height])
        .stroke(borderColor.bottom)
        .restore();
    }
    // Left
    if (computedBorder.left > 0) {
      this.document
        .save()
        .lineWidth(computedBorder.left)
        .polygon([x, y + height], [x, y])
        .stroke(borderColor.left)
        .restore();
    }
  }
}
