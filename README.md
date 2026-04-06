# FeedA
'FeedA(피다)'는 Feedback과 Academy의 합성어로, 피드백을 통해 더 나은 학습 환경이 '피어난다'는 중의적 의미를 담고 있습니다.

---

# Git Convention

## **🔵 Branch & Issue Convention**

- `main` : 최종 배포 브랜치
- `feat` : 기능 단위 개발
- `fix` : 버그 및 오류 수정
- `style` : UI 스타일 관련 변경
- `refactor` : 코드 구조 개선 (성능 향상 포함)
- `chore` : 그 외 (문서, 환경 설정, 단순 주석)

### 예시

- Branch
    - feat/이슈 번호-기능명
    - ex) `feat/21-header`
- Issue
    - 이슈 항목: 개발 내용
    - ex) `feat: Header 구현`

## **🔵 Commit Convention**

- `feat` : 새로운 기능 추가
- `fix` : 버그, 오류 해결
- `build`: 빌드 시스템이나 외부 패키지 의존성에 변화를 준 경우
- `docs`: 문서 또는 주석만 바뀐 경우
- `perf`: 성능 향상을 위한 코드 변경
- `refactor`: 버그 픽스나 새 기능 추가 또는 기존 기능 수정, 성능 향상 용도가 아닌 ****코드 변경 (기능 상의 변화가 없는 경우)
- `style`: UI 스타일 관련 변경
- `test`: 새 테스트 추가 또는 존재하는 테스트 수정
- `ci` : CI관련 설정 수정에 대한 커밋
- `chore` : 그 외 자잘한 수정에 대한 커밋

```
ex)

fix: 시험 종료 기능 수정

[본문(선택 사항)]
```
