import { describe, it, expect } from "vitest";
import { filter_context, sort_context } from "../src/query.js";

describe('filter_context', () => {
    it('lists the result count and active filters', () => {
        expect(filter_context(3, { status: 'TODO', priority: 'HIGH' }))
            .toBe('3 matches · status=TODO · priority=HIGH')
    })

    it('quotes title and description filters', () => {
        expect(filter_context(1, { title: 'login page', description: 'bug' }))
            .toBe('1 match · title~"login page" · description~"bug"')
    })

    it('joins labels with a plus', () => {
        expect(filter_context(2, { label: ['bug', 'auth'] }))
            .toBe('2 matches · labels=bug+auth')
    })

    it('omits the separator when no filters are active', () => {
        expect(filter_context(5, {})).toBe('5 matches')
    })
})

describe('sort_context', () => {
    it('lists the result count and sort order', () => {
        expect(sort_context(5, 'priority', 'desc')).toBe('5 issues · sorted by priority desc')
    })

    it('uses the default id asc order', () => {
        expect(sort_context(1)).toBe('1 issue · sorted by id asc')
    })
})
