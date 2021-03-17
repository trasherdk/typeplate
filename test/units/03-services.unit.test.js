const expect = require('chai').expect;
const sinon = require('sinon');

const fs = require('fs');

const fixtures = require(process.cwd() + '/test/utils/fixtures');

const { User } = require(process.cwd() + '/dist/api/models/user.model');

const { SanitizeService } = require(process.cwd() + '/dist/api/services/sanitizer.service');
const { AuthService } = require(process.cwd() + '/dist/api/services/auth.service');
const { MediaService} = require(process.cwd() + '/dist/api/services/media.service');
const { CacheService } = require(process.cwd() + '/dist/api/services/cache.service');
const { Logger } = require(process.cwd() + '/dist/api/services/logger.service');
const { LoggerConfiguration } = require(process.cwd() + '/dist/api/config/logger.config');
const { CacheConfiguration } = require(process.cwd() + '/dist/api/config/cache.config');

describe('Services', () => {

  describe('AuthService', () => {

    describe('generateTokenResponse()', () => {

      it('should return error', async () => {
        const result = await AuthService.generateTokenResponse({}, '',  null);
        expect(result).is.instanceOf(Error);
      });
  
      it('should return well formed token', async () => {
        const result = await AuthService.generateTokenResponse(new User(), '',  null);
        expect(result).to.haveOwnProperty('tokenType');
        expect(result).to.haveOwnProperty('accessToken');
        expect(result).to.haveOwnProperty('refreshToken');
        expect(result).to.haveOwnProperty('expiresIn');
      });

    });

    describe('oAuth()', () => {

      it('should next with error if data cannot be retrieved from provider', async () => {
        await AuthService.oAuth('', '',  null, (error, user) => { 
          expect(error).is.instanceOf(Error);
        });
      });
  
      it('should next with User instance', async () => {
        await AuthService.oAuth('', '', fixtures.token.oauthFacebook, (error, user) => { 
          if (error) throw error;
          expect(user).to.haveOwnProperty('id');
          expect(user).to.haveOwnProperty('username');
          expect(user).to.haveOwnProperty('email');
          expect(user).to.haveOwnProperty('role');
          expect(user).to.haveOwnProperty('password');
          expect(user).to.haveOwnProperty('apikey');   
        });
      });

    });

    describe('jwt()', () => {

      it('should next with error', async () =>  {
        await AuthService.jwt({ alter: 0 }, (error, result) => {
          expect(error).is.instanceOf(Error);
          expect(result).is.false;
        });
      });
  
      it('should next with false if user not found', async () => {
        await AuthService.jwt({ sub: 0 }, (error, result) => {
          expect(result).is.false;
        });
      });
  
      it('should next with User instance', async () => {
        await AuthService.jwt({ sub: 1 }, (error, result) => {
          expect(result).is.an('object');
        });
      });

    });

  });

  describe('CacheService', () => {

    describe('resolve', () => {

      it('should return memory cache instance', () => {
        const result = CacheService.engine;
        expect(result).to.be.an('object');
      });

    });

    describe('isActive', () => {

      it('should return memory cache enabled from env value', () => {
        expect(CacheService.isActive).to.be.eqls(CacheConfiguration.options.IS_ACTIVE);
      });

    });

    describe('duration', () => {

      it('should return memory cache duration from env value', () => {
        expect(CacheService.duration).to.be.eqls(CacheConfiguration.options.DURATION);
      });

    });

    describe('key()', () => {

      it('should return well formated key with crypted q params', () => {
        const req = {
          baseUrl: '/api/v1',
          path: '/medias/',
          query: { type: 'image' }
        };
        const result = CacheService.key(req);
        expect(result).to.includes('__mcache_/api/v1/medias/?q=');
        expect(result.split('q=')[1]).to.be.a('string')
      });

    });

    describe('refresh()', () => {

      it('should refresh current cache', () => {
        const stubIsActive = sinon.stub(CacheConfiguration.options, 'IS_ACTIVE').value(true);
        const req = {
          baseUrl: '/api/v1',
          path: '/medias/',
          query: { type: 'image' }
        };
        const key = CacheService.key(req);
        CacheService.engine.put(key, 'cached');
        expect(CacheService.engine.get(key)).to.be.eqls('cached');
        CacheService.refresh('medias');
        expect(CacheService.engine.get(key)).to.be.null;
        stubIsActive.restore();
      });

    });

    describe('put()', () => {

      it('should push a data into the cache', () => {
        const url = '/path-to-the-light/door/25';
        const key = CacheService.key( { url });
        const cached = CacheService.engine.put(key, { data: 'Yoda is into the game' } );
        expect(cached).to.be.an('object');
        expect(cached.data).to.be.eqls('Yoda is into the game');
      });

    });

    describe('get()', () => {

      it('should retrieve data from the cache', () => {
        const url = '/path-to-the-light/door/25';
        const key = CacheService.key( { url });
        const cached = CacheService.engine.get(key);
        expect(cached).to.be.an('object');
        expect(cached.data).to.be.eqls('Yoda is into the game');
      });

    });

  });

  describe('MediaService', () => {

    describe('remove()', () => {

      it('should remove all scaled images', () => {
        const image = fixtures.media.image({id:1});
        fs.copyFileSync(`${process.cwd()}/test/utils/fixtures/files/${image.filename}`, `${process.cwd()}/dist/public/images/master-copy/${image.filename}`);
        ['xs', 'sm', 'md', 'lg', 'xl'].forEach(size => {
          fs.copyFileSync(`${process.cwd()}/test/utils/fixtures/files/${image.filename}`, `${process.cwd()}/dist/public/images/rescale/${size}/${image.filename}`);
        });
        MediaService.remove(fixtures.media.image({id:1}));
        setTimeout(() => {
          expect(fs.existsSync(`${process.cwd()}/dist/public/images/master-copy/${image.filename}`)).to.be.false;
          ['xs', 'sm', 'md', 'lg', 'xl'].forEach(size => {
            expect(fs.existsSync(`${process.cwd()}/dist/public/images/rescale/${size}/${image.filename}`)).to.be.false;
          });
          done();
        }, 500)
      });

    });

  });

  describe('Sanitize', () => {
      
    describe('isSanitizable()', () => {

      it('should return false on primitive type', function(done) {
        const result = SanitizeService.isSanitizable('yoda');
        expect(result).to.be.false;
        done();
      });
      
      it('should return false on primitive type array', function(done) {
        const result = SanitizeService.isSanitizable(['yoda']);
        expect(result).to.be.false;
        done();
      });
    
      it('should return false on primitive object', function(done) {
        const result = SanitizeService.isSanitizable({ name: 'yoda' });
        expect(result).to.be.false;
        done();
      });
    
      it('should return false on mixed array', function(done) {
        const result = SanitizeService.isSanitizable([{ name: 'yoda'}, 'dark vador']);
        expect(result).to.be.false;
        done();
      });
    
      it('should return true on IModel instance', function(done) {
        const result = SanitizeService.isSanitizable( new User() );
        expect(result).to.be.true;
        done();
      });
    
      it('should return true on IModel instance array', function(done) {
        const result = SanitizeService.isSanitizable( [ new User(), new User() ] );
        expect(result).to.be.true;
        done();
      });

    });

    describe('sanitize()', () => {

      it('should return sanitized object', function(done) {
        const entity = function() {
          const self = {};
          self.id = 1;
          self.name = 'Yoda';
          self.password = '123456';
          self.whitelist =  ['id', 'name'];
          return self
        }
        const result = SanitizeService.sanitize(new entity());
        expect(result).to.haveOwnProperty('id');
        expect(result).to.haveOwnProperty('name');
        expect(result).to.not.haveOwnProperty('password');
        done();
      });

    });
  
  });

  describe('Logger', () => {

    describe('log()', () => {

      it.skip('should call Logger.log with level and message', () => {});

    });

  });
});