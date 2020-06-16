/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { DocumentKey } from '../model/document_key';
import { ResourcePath } from '../model/path';
import { isNullOrUndefined } from '../util/types';
import {
  Bound,
  canonifyBound,
  canonifyFieldFilter,
  canonifyOrderBy,
  FieldFilter,
  filterEquals,
  OrderBy,
  stringifyFieldFilter,
  stringifyOrderBy
} from './query';
import { debugCast } from '../util/assert';

/**
 * A Target represents the WatchTarget representation of a Query, which is used
 * by the LocalStore and the RemoteStore to keep track of and to execute
 * backend queries. While a Query can represent multiple Targets, each Targets
 * maps to a single WatchTarget in RemoteStore and a single TargetData entry
 * in persistence.
 */
export class Target {
  protected constructor(
    readonly path: ResourcePath,
    readonly collectionGroup: string | null,
    readonly orderBy: OrderBy[],
    readonly filters: FieldFilter[],
    readonly limit: number | null,
    readonly startAt: Bound | null,
    readonly endAt: Bound | null
  ) {}

  isEqual(other: Target): boolean {
    if (this.limit !== other.limit) {
      return false;
    }

    if (this.orderBy.length !== other.orderBy.length) {
      return false;
    }

    for (let i = 0; i < this.orderBy.length; i++) {
      if (!this.orderBy[i].isEqual(other.orderBy[i])) {
        return false;
      }
    }

    if (this.filters.length !== other.filters.length) {
      return false;
    }

    for (let i = 0; i < this.filters.length; i++) {
      if (!filterEquals(this.filters[i], other.filters[i])) {
        return false;
      }
    }

    if (this.collectionGroup !== other.collectionGroup) {
      return false;
    }

    if (!this.path.isEqual(other.path)) {
      return false;
    }

    if (
      this.startAt !== null
        ? !this.startAt.isEqual(other.startAt)
        : other.startAt !== null
    ) {
      return false;
    }

    return this.endAt !== null
      ? this.endAt.isEqual(other.endAt)
      : other.endAt === null;
  }

  isDocumentQuery(): boolean {
    return (
      DocumentKey.isDocumentKey(this.path) &&
      this.collectionGroup === null &&
      this.filters.length === 0
    );
  }
}

class TargetImpl extends Target {
  memoizedCanonicalId: string | null = null;
  constructor(
    path: ResourcePath,
    collectionGroup: string | null = null,
    orderBy: OrderBy[] = [],
    filters: FieldFilter[] = [],
    limit: number | null = null,
    startAt: Bound | null = null,
    endAt: Bound | null = null
  ) {
    super(path, collectionGroup, orderBy, filters, limit, startAt, endAt);
  }
}

/**
 * Initializes a Target with a path and optional additional query constraints.
 * Path must currently be empty if this is a collection group query.
 *
 * NOTE: you should always construct `Target` from `Query.toTarget` instead of
 * using this factory method, because `Query` provides an implicit `orderBy`
 * property.
 */
export function newTarget(
  path: ResourcePath,
  collectionGroup: string | null = null,
  orderBy: OrderBy[] = [],
  filters: FieldFilter[] = [],
  limit: number | null = null,
  startAt: Bound | null = null,
  endAt: Bound | null = null
): Target {
  return new TargetImpl(
    path,
    collectionGroup,
    orderBy,
    filters,
    limit,
    startAt,
    endAt
  );
}

export function canonifyTarget(target: Target): string {
  const targetImpl = debugCast(target, TargetImpl);

  if (targetImpl.memoizedCanonicalId === null) {
    let canonicalId = targetImpl.path.canonicalString();
    if (targetImpl.collectionGroup !== null) {
      canonicalId += '|cg:' + targetImpl.collectionGroup;
    }
    canonicalId += '|f:';
    canonicalId += targetImpl.filters
      .map(f => canonifyFieldFilter(f))
      .join(',');
    canonicalId += '|ob:';
    canonicalId += targetImpl.orderBy.map(o => canonifyOrderBy(o)).join(',');

    if (!isNullOrUndefined(targetImpl.limit)) {
      canonicalId += '|l:';
      canonicalId += targetImpl.limit!;
    }
    if (targetImpl.startAt) {
      canonicalId += '|lb:';
      canonicalId += canonifyBound(targetImpl.startAt);
    }
    if (targetImpl.endAt) {
      canonicalId += '|ub:';
      canonicalId += canonifyBound(targetImpl.endAt);
    }
    targetImpl.memoizedCanonicalId = canonicalId;
  }
  return targetImpl.memoizedCanonicalId;
}

export function stringifyTarget(target: Target): string {
  let str = target.path.canonicalString();
  if (target.collectionGroup !== null) {
    str += ' collectionGroup=' + target.collectionGroup;
  }
  if (target.filters.length > 0) {
    str += `, filters: [${target.filters
      .map(f => stringifyFieldFilter(f))
      .join(', ')}]`;
  }
  if (!isNullOrUndefined(target.limit)) {
    str += ', limit: ' + target.limit;
  }
  if (target.orderBy.length > 0) {
    str += `, orderBy: [${target.orderBy
      .map(o => stringifyOrderBy(o))
      .join(', ')}]`;
  }
  if (target.startAt) {
    str += ', startAt: ' + canonifyBound(target.startAt);
  }
  if (target.endAt) {
    str += ', endAt: ' + canonifyBound(target.endAt);
  }
  return `Target(${str})`;
}
