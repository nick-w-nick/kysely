import {
  BUILT_IN_DIALECTS,
  clearDatabase,
  destroyTest,
  initTest,
  insertPersons,
  TestContext,
  testSql,
  expect,
} from './test-setup'

for (const dialect of BUILT_IN_DIALECTS) {
  describe(`${dialect}: join`, () => {
    let ctx: TestContext

    before(async () => {
      ctx = await initTest(dialect)
    })

    beforeEach(async () => {
      await insertPersons(ctx, [
        {
          first_name: 'Jennifer',
          last_name: 'Aniston',
          gender: 'female',
          pets: [
            {
              name: 'Catto',
              species: 'cat',
              toys: [{ name: 'spool', price: 10 }],
            },
          ],
        },
        {
          first_name: 'Arnold',
          last_name: 'Schwarzenegger',
          gender: 'male',
          pets: [{ name: 'Doggo', species: 'dog' }],
        },
        {
          first_name: 'Sylvester',
          last_name: 'Stallone',
          gender: 'male',
          pets: [{ name: 'Hammo', species: 'hamster' }],
        },
      ])
    })

    afterEach(async () => {
      await clearDatabase(ctx)
    })

    after(async () => {
      await destroyTest(ctx)
    })

    for (const [joinType, joinSql] of [
      ['innerJoin', 'inner join'],
      ['leftJoin', 'left join'],
      ['rightJoin', 'right join'],
      ['fullJoin', 'full join'],
    ] as const) {
      it(`should ${joinSql} a table`, async () => {
        const query = ctx.db
          .selectFrom('person')
          [joinType]('pet', 'pet.owner_id', 'person.id')
          .selectAll()
          .orderBy('person.first_name')

        testSql(query, dialect, {
          postgres: {
            sql: `select * from "person" ${joinSql} "pet" on "pet"."owner_id" = "person"."id" order by "person"."first_name" asc`,
            bindings: [],
          },
        })

        const result = await query.execute()

        expect(result).to.have.length(3)
        expect(result).to.containSubset([
          {
            first_name: 'Jennifer',
            last_name: 'Aniston',
            name: 'Catto',
          },
          {
            first_name: 'Arnold',
            last_name: 'Schwarzenegger',
            name: 'Doggo',
          },
          {
            first_name: 'Sylvester',
            last_name: 'Stallone',
            name: 'Hammo',
          },
        ])
      })

      it(`should ${joinSql} multiple tables`, async () => {
        const query = ctx.db
          .selectFrom('person')
          [joinType]('pet', 'pet.owner_id', 'person.id')
          [joinType]('toy', 'toy.pet_id', 'pet.id')
          .select(['pet.name as pet_name', 'toy.name as toy_name'])
          .where('first_name', '=', 'Jennifer')

        testSql(query, dialect, {
          postgres: {
            sql: `select "pet"."name" as "pet_name", "toy"."name" as "toy_name" from "person" ${joinSql} "pet" on "pet"."owner_id" = "person"."id" ${joinSql} "toy" on "toy"."pet_id" = "pet"."id" where "first_name" = $1`,
            bindings: ['Jennifer'],
          },
        })

        const result = await query.execute()

        expect(result).to.have.length(1)
        expect(result).to.containSubset([
          {
            pet_name: 'Catto',
            toy_name: 'spool',
          },
        ])
      })

      it(`should ${joinSql} a table using multiple "on" statements`, async () => {
        const query = ctx.db
          .selectFrom('person')
          [joinType]('pet', (join) =>
            join
              .onRef('pet.owner_id', '=', 'person.id')
              .on('pet.name', 'in', ['Catto', 'Doggo', 'Hammo'])
              .on((jb) =>
                jb
                  .on('pet.species', '=', 'cat')
                  .orOn('species', '=', 'dog')
                  .orOn('species', '=', 'hamster')
              )
          )
          .selectAll()
          .orderBy('person.first_name')

        testSql(query, dialect, {
          postgres: {
            sql: `select * from "person" ${joinSql} "pet" on "pet"."owner_id" = "person"."id" and "pet"."name" in ($1, $2, $3) and ("pet"."species" = $4 or "species" = $5 or "species" = $6) order by "person"."first_name" asc`,
            bindings: ['Catto', 'Doggo', 'Hammo', 'cat', 'dog', 'hamster'],
          },
        })

        const result = await query.execute()

        expect(result).to.have.length(3)
        expect(result).to.containSubset([
          {
            first_name: 'Jennifer',
            last_name: 'Aniston',
            name: 'Catto',
          },
          {
            first_name: 'Arnold',
            last_name: 'Schwarzenegger',
            name: 'Doggo',
          },
          {
            first_name: 'Sylvester',
            last_name: 'Stallone',
            name: 'Hammo',
          },
        ])
      })
    }
  })
}
