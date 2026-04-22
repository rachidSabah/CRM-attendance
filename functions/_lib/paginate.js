/**
 * Paginated query helper for D1.
 * D1's .all() returns max ~1000 rows. This helper fetches ALL rows
 * by iterating with LIMIT/OFFSET until no more results are returned.
 *
 * Usage:
 *   const rows = await fetchAll(db, 'SELECT * FROM table WHERE tenant_id = ?', [tenantId]);
 *
 * @param {D1Database} db
 * @param {string} sql - SQL query (must not include LIMIT/OFFSET)
 * @param {Array} bindParams - Parameters to bind
 * @param {number} pageSize - Rows per page (default 1000)
 * @returns {Promise<Array>} All matching rows
 */
export async function fetchAll(db, sql, bindParams = [], pageSize = 1000) {
  const allRows = [];
  let offset = 0;

  while (true) {
    // Append LIMIT and OFFSET to the query
    const paginatedSql = `${sql} LIMIT ? OFFSET ?`;
    const params = [...bindParams, pageSize, offset];
    const result = await db.prepare(paginatedSql).bind(...params).all();

    if (!result.results || result.results.length === 0) break;

    allRows.push(...result.results);

    // If we got fewer rows than pageSize, we've reached the end
    if (result.results.length < pageSize) break;

    offset += pageSize;
  }

  return allRows;
}
