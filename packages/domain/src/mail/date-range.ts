/**
 * DateRange — immutable date range value object.
 */
export class DateRange {
  constructor(
    public readonly start: Date,
    public readonly end: Date
  ) {
    if (start > end) {
      throw new Error('Start date must be before end date');
    }
  }

  contains(date: Date): boolean {
    return date >= this.start && date <= this.end;
  }

  overlaps(other: DateRange): boolean {
    return this.start <= other.end && other.start <= this.end;
  }

  static ofDays(days: number): DateRange {
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    return new DateRange(start, end);
  }
}
