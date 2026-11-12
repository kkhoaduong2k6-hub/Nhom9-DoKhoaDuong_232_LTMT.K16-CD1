exports.ok = (res, data, message, status = 200) =>
  res.status(status).json({ success: true, ...(message && { message }), data });

exports.created = (res, data, message = 'Tạo thành công') => exports.ok(res, data, message, 201);

exports.noContent = (res) => res.status(204).send();

exports.paginated = (res, items, total, page, limit) =>
  res.json({
    success: true,
    data: items,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
  });