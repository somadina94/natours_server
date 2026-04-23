import type { Query } from "mongoose";

export default class APIFeatures {
  query: Query<unknown[], unknown>;
  queryString: Record<string, string | undefined>;

  constructor(
    query: Query<unknown[], unknown>,
    queryString: Record<string, string | undefined>,
  ) {
    this.query = query;
    this.queryString = queryString;
  }

  filter(): this {
    const queryObj: Record<string, unknown> = { ...this.queryString };
    const excludedFields = ["page", "sort", "limit", "fields"];
    for (const el of excludedFields) {
      delete queryObj[el];
    }

    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

    const parsed = JSON.parse(queryStr) as Record<string, unknown>;
    this.query = this.query.find(parsed as never);
    return this;
  }

  sort(): this {
    const raw = this.queryString.sort;
    const sortStr = Array.isArray(raw) ? raw[0] : raw;
    if (sortStr) {
      const sortBy = sortStr.split(",").join(" ");
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort("-createdAt");
    }
    return this;
  }

  limitFields(): this {
    const raw = this.queryString.fields;
    const fieldsStr = Array.isArray(raw) ? raw[0] : raw;
    if (fieldsStr) {
      const fields = fieldsStr.split(",").join(" ");
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select("-__v");
    }
    return this;
  }

  paginate(): this {
    const pageRaw = this.queryString.page;
    const limitRaw = this.queryString.limit;
    const pageStr = Array.isArray(pageRaw) ? pageRaw[0] : pageRaw;
    const limitStr = Array.isArray(limitRaw) ? limitRaw[0] : limitRaw;
    const page = Number(pageStr) || 1;
    const limit = Number(limitStr) || 100;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);

    return this;
  }
}
